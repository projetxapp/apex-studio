import type {
  Competition,
  CompetitionResult,
  DayInput,
  Member,
  MemberId,
  Moment,
  MomentStat,
  MomentType,
  MomentValue,
  Provenance,
} from '@/domain/types';
import { plausibility } from './competition';
import { HistoryIndex, mean, pairKey, weakest } from './history';

/**
 * Each rule looks at one day (plus history) and proposes zero or more candidates.
 * Rules are pure functions: same input, same output. No network, no LLM.
 */

export interface Candidate {
  type: MomentType;
  memberIds: MemberId[];
  vars: Record<string, MomentValue>;
  stats: MomentStat[];
  /** Raw interest 0–100 before novelty adjustment. */
  baseScore: number;
  provenance: Provenance;
  noveltyKey: string;
  results?: CompetitionResult[];
}

export interface RuleContext {
  day: DayInput;
  history: HistoryIndex;
  members: Member[];
  competition: Competition;
  results: CompetitionResult[];
  pastMoments: Moment[];
}

export type Rule = (ctx: RuleContext) => Candidate[];

/** The time at which the Daily Drop is computed (21:00), in minutes since midnight. */
export const DROP_MINUTE = 21 * 60;

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const dur = (v: number): MomentValue => ({ v, f: 'duration' });
const int = (v: number): MomentValue => ({ v, f: 'int' });
const clock = (v: number): MomentValue => ({ v, f: 'clock' });
const text = (v: string): MomentValue => ({ v, f: 'text' });
const hasSource = (ctx: RuleContext, id: MemberId, s: Member['sources'][number]) =>
  ctx.members.find((m) => m.id === id)?.sources.includes(s) ?? false;

// ——— Social ————————————————————————————————————————————————————————

/** Two consenting members spent a long verified stretch together. */
export const bromance: Rule = ({ day }) => {
  const MIN = 180;
  return day.encounters
    .filter((e) => e.minutes >= MIN && e.provenance !== 'manual')
    .map((e) => ({
      type: 'BROMANCE' as const,
      memberIds: [e.a, e.b],
      vars: { minutes: dur(e.minutes) },
      stats: [{ key: 'together', value: dur(e.minutes) }],
      baseScore: clamp(55 + (e.minutes - MIN) / 5),
      provenance: e.provenance,
      noveltyKey: `BROMANCE:${pairKey(e.a, e.b)}`,
    }));
};

/** A usually inseparable pair barely saw each other. */
export const troubleInParadise: Rule = ({ day, history, members }) => {
  const out: Candidate[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i].id;
      const b = members[j].id;
      const usual = history.pairAverage(a, b, day.date, 14);
      if (usual < 120) continue;
      const today = day.encounters.find((e) => pairKey(e.a, e.b) === pairKey(a, b));
      const minutes = today?.minutes ?? 0;
      if (minutes > Math.min(30, usual * 0.15)) continue;
      out.push({
        type: 'TROUBLE_IN_PARADISE',
        memberIds: [a, b],
        vars: { minutes: dur(minutes), usual: dur(usual) },
        stats: [
          { key: 'today', value: dur(minutes) },
          { key: 'usual', value: dur(usual) },
        ],
        baseScore: clamp(62 + usual / 12),
        // "Barely together" can only be inferred; simulated history stays simulated.
        provenance: weakest(
          'inferred',
          ...(today ? [today.provenance] : []),
          ...history.recent(day.date, 14).flatMap((d) => d.encounters.filter((e) => pairKey(e.a, e.b) === pairKey(a, b)).map((e) => e.provenance)),
        ),
        noveltyKey: `TROUBLE:${pairKey(a, b)}`,
      });
    }
  }
  return out;
};

/** A member with proximity enabled crossed nobody today, and not since at least yesterday. */
export const missing: Rule = (ctx) => {
  const { day, history, members } = ctx;
  const out: Candidate[] = [];
  for (const member of members) {
    if (!member.sources.includes('proximity')) continue;
    if (day.encounters.some((e) => e.a === member.id || e.b === member.id)) continue;
    const last = history.lastEncounterOf(member.id);
    if (!last) continue;
    const daysAgo = history.days.length
      ? Math.round((Date.parse(day.date) - Date.parse(last.date)) / 86_400_000)
      : 0;
    const hours = (daysAgo * 1440 + DROP_MINUTE - last.endedAt) / 60;
    if (hours < 24) continue;
    out.push({
      type: 'MISSING',
      memberIds: [member.id],
      vars: { hours: { v: hours, f: 'hours' } },
      stats: [{ key: 'hours', value: { v: hours, f: 'hours' } }],
      baseScore: clamp(52 + hours / 3),
      provenance: weakest(last.provenance, 'inferred'),
      noveltyKey: `MISSING:${member.id}`,
    });
  }
  return out;
};

/** Several members gathered for a meaningful period. */
export const linkUp: Rule = ({ day, history, members }) => {
  const monthBest = Math.max(
    0,
    ...history.sameMonth(day.date).flatMap((d) => d.gatherings.map((g) => g.memberIds.length * g.minutes)),
  );
  return day.gatherings
    .filter((g) => g.memberIds.length >= 4 && g.minutes >= 60)
    .map((g) => {
      const weight = g.memberIds.length * g.minutes;
      const biggest = weight > monthBest;
      return {
        type: 'THE_LINK_UP' as const,
        memberIds: g.memberIds,
        vars: {
          count: int(g.memberIds.length),
          total: int(members.length),
          minutes: dur(g.minutes),
          biggest: text(biggest ? 'yes' : 'no'),
        },
        stats: [
          { key: 'members', value: { v: `${g.memberIds.length}/${members.length}`, f: 'text' } },
          { key: 'duration', value: dur(g.minutes) },
        ],
        baseScore: clamp(50 + g.memberIds.length * 5 + g.minutes / 12 + (biggest ? 12 : 0)),
        provenance: g.provenance,
        noveltyKey: `LINKUP:${[...g.memberIds].sort().join('|')}`,
      };
    });
};

/** Two members with near-identical departure and return times, without being together. */
export const weirdlyInSync: Rule = (ctx) => {
  const { day } = ctx;
  const withRoutine = day.metrics.filter(
    (m) => m.leftHomeAt !== undefined && m.returnedHomeAt !== undefined && hasSource(ctx, m.memberId, 'routine'),
  );
  const out: Candidate[] = [];
  for (let i = 0; i < withRoutine.length; i++) {
    for (let j = i + 1; j < withRoutine.length; j++) {
      const a = withRoutine[i];
      const b = withRoutine[j];
      const leftDiff = Math.abs((a.leftHomeAt as number) - (b.leftHomeAt as number));
      const returnDiff = Math.abs((a.returnedHomeAt as number) - (b.returnedHomeAt as number));
      if (leftDiff > 10 || returnDiff > 15) continue;
      // Being together all day would make this trivial, not weird.
      const together = day.encounters.find((e) => pairKey(e.a, e.b) === pairKey(a.memberId, b.memberId));
      if (together && together.minutes > 60) continue;
      out.push({
        type: 'WEIRDLY_IN_SYNC',
        memberIds: [a.memberId, b.memberId],
        vars: { leftDiff: dur(leftDiff), returnDiff: dur(returnDiff) },
        stats: [
          { key: 'leftDiff', value: dur(leftDiff) },
          { key: 'returnDiff', value: dur(returnDiff) },
        ],
        baseScore: clamp(80 - leftDiff * 2 - returnDiff),
        provenance: weakest(a.provenance, b.provenance),
        noveltyKey: `SYNC:${pairKey(a.memberId, b.memberId)}`,
      });
    }
  }
  return out;
};

/** Two members woke up at the exact same minute. */
export const sameMinute: Rule = (ctx) => {
  const byMinute = new Map<number, typeof ctx.day.metrics>();
  for (const m of ctx.day.metrics) {
    if (m.wakeTime === undefined || !hasSource(ctx, m.memberId, 'sleep')) continue;
    byMinute.set(m.wakeTime, [...(byMinute.get(m.wakeTime) ?? []), m]);
  }
  const out: Candidate[] = [];
  for (const [minute, list] of byMinute) {
    if (list.length < 2) continue;
    const [a, b] = list;
    out.push({
      type: 'SAME_MINUTE',
      memberIds: [a.memberId, b.memberId],
      vars: { time: clock(minute) },
      stats: [{ key: 'wake', value: clock(minute) }],
      baseScore: 64,
      provenance: weakest(a.provenance, b.provenance),
      noveltyKey: `SAMEMIN:${pairKey(a.memberId, b.memberId)}`,
    });
  }
  return out;
};

/** Several members had the same top artist. */
export const musicTwins: Rule = (ctx) => {
  const byArtist = new Map<string, MemberId[]>();
  for (const m of ctx.day.metrics) {
    if (!m.topArtist || !hasSource(ctx, m.memberId, 'music')) continue;
    byArtist.set(m.topArtist, [...(byArtist.get(m.topArtist) ?? []), m.memberId]);
  }
  const out: Candidate[] = [];
  for (const [artist, ids] of byArtist) {
    if (ids.length < 2) continue;
    out.push({
      type: 'MUSIC_TWINS',
      memberIds: ids,
      vars: { artist: text(artist) },
      stats: [{ key: 'members', value: int(ids.length) }],
      baseScore: 40 + ids.length * 6,
      provenance: weakest(...ctx.day.metrics.filter((m) => ids.includes(m.memberId)).map((m) => m.provenance)),
      noveltyKey: `MUSIC:${artist}`,
    });
  }
  return out;
};

// ——— Facts (never competitive: easy to game) ———————————————————————————————

/** Latest bedtime of the night, if it is really late. */
export const nightOwl: Rule = (ctx) => {
  const late = ctx.day.metrics
    .filter((m) => m.bedtime !== undefined && m.bedtime >= 1440 + 75 && hasSource(ctx, m.memberId, 'sleep'))
    .sort((a, b) => (b.bedtime as number) - (a.bedtime as number));
  if (!late.length) return [];
  const m = late[0];
  return [
    {
      type: 'NIGHT_OWL',
      memberIds: [m.memberId],
      vars: { time: clock(m.bedtime as number) },
      stats: [{ key: 'bedtime', value: clock(m.bedtime as number) }],
      baseScore: clamp(40 + ((m.bedtime as number) - 1440 - 75) / 4),
      provenance: m.provenance,
      noveltyKey: `NIGHTOWL:${m.memberId}`,
    },
  ];
};

/** Someone got up much earlier than their own habit. */
export const earlyBird: Rule = (ctx) => {
  const out: Candidate[] = [];
  for (const m of ctx.day.metrics) {
    if (m.wakeTime === undefined || m.wakeTime > 6 * 60 + 30 || !hasSource(ctx, m.memberId, 'sleep')) continue;
    const usual = mean(ctx.history.series(m.memberId, ctx.day.date, 14, (x) => x.wakeTime));
    if (usual === null || usual - m.wakeTime < 60) continue;
    out.push({
      type: 'EARLY_BIRD',
      memberIds: [m.memberId],
      vars: { time: clock(m.wakeTime) },
      stats: [{ key: 'wake', value: clock(m.wakeTime) }],
      baseScore: clamp(40 + (usual - m.wakeTime) / 6),
      provenance: m.provenance,
      noveltyKey: `EARLY:${m.memberId}`,
    });
  }
  return out.sort((a, b) => b.baseScore - a.baseScore).slice(0, 1);
};

export const sleepChamp: Rule = (ctx) => {
  const best = ctx.day.metrics
    .filter((m) => (m.sleepMinutes ?? 0) >= 600 && hasSource(ctx, m.memberId, 'sleep'))
    .sort((a, b) => (b.sleepMinutes as number) - (a.sleepMinutes as number))[0];
  if (!best) return [];
  return [
    {
      type: 'SLEEP_CHAMP',
      memberIds: [best.memberId],
      vars: { minutes: dur(best.sleepMinutes as number) },
      stats: [{ key: 'sleep', value: dur(best.sleepMinutes as number) }],
      baseScore: clamp(35 + ((best.sleepMinutes as number) - 600) / 4),
      provenance: best.provenance,
      noveltyKey: `SLEEP:${best.memberId}`,
    },
  ];
};

export const homebody: Rule = (ctx) =>
  ctx.day.metrics
    .filter((m) => hasSource(ctx, m.memberId, 'routine') && m.placesVisited === 0 && m.leftHomeAt === undefined)
    .slice(0, 1)
    .map((m) => ({
      type: 'HOMEBODY' as const,
      memberIds: [m.memberId],
      vars: {},
      stats: [{ key: 'places', value: int(0) }],
      baseScore: 45,
      provenance: m.provenance,
      noveltyKey: `HOMEBODY:${m.memberId}`,
    }));

export const explorer: Rule = (ctx) => {
  const best = ctx.day.metrics
    .filter((m) => (m.placesVisited ?? 0) >= 6 && hasSource(ctx, m.memberId, 'routine'))
    .sort((a, b) => (b.placesVisited as number) - (a.placesVisited as number))[0];
  if (!best) return [];
  return [
    {
      type: 'EXPLORER',
      memberIds: [best.memberId],
      vars: { count: int(best.placesVisited as number) },
      stats: [{ key: 'places', value: int(best.placesVisited as number) }],
      baseScore: clamp(38 + (best.placesVisited as number) * 3),
      provenance: best.provenance,
      noveltyKey: `EXPLORER:${best.memberId}`,
    },
  ];
};

export const photoDump: Rule = (ctx) => {
  const best = ctx.day.metrics
    .filter((m) => (m.photosTaken ?? 0) >= 80 && hasSource(ctx, m.memberId, 'photos'))
    .sort((a, b) => (b.photosTaken as number) - (a.photosTaken as number))[0];
  if (!best) return [];
  return [
    {
      type: 'PHOTO_DUMP',
      memberIds: [best.memberId],
      vars: { count: int(best.photosTaken as number) },
      stats: [{ key: 'photos', value: int(best.photosTaken as number) }],
      baseScore: clamp(36 + (best.photosTaken as number) / 8),
      provenance: best.provenance,
      noveltyKey: `PHOTO:${best.memberId}`,
    },
  ];
};

export const calendarChaos: Rule = (ctx) => {
  const best = ctx.day.metrics
    .filter((m) => (m.calendarEvents ?? 0) >= 6 && hasSource(ctx, m.memberId, 'calendar'))
    .sort((a, b) => (b.calendarEvents as number) - (a.calendarEvents as number))[0];
  if (!best) return [];
  return [
    {
      type: 'CALENDAR_CHAOS',
      memberIds: [best.memberId],
      vars: { count: int(best.calendarEvents as number) },
      stats: [{ key: 'events', value: int(best.calendarEvents as number) }],
      baseScore: clamp(34 + (best.calendarEvents as number) * 3),
      provenance: best.provenance,
      noveltyKey: `CAL:${best.memberId}`,
    },
  ];
};

const COMPARISONS: { key: string; km: number }[] = [
  { key: 'channel', km: 34 },
  { key: 'peripherique', km: 35 },
  { key: 'marathon', km: 42.195 },
  { key: 'versailles', km: 17 },
];

/** Group-wide total, compared to something tangible. Low score: filler, not a headline. */
export const groupStat: Rule = (ctx) => {
  const withDistance = ctx.day.metrics.filter((m) => m.distanceKm !== undefined && m.provenance !== 'manual');
  if (withDistance.length < 3) return [];
  const km = withDistance.reduce((s, m) => s + (m.distanceKm as number), 0);
  // Pick the comparison that gives the "nicest" multiple.
  const scored = COMPARISONS.map((c) => ({ ...c, times: km / c.km })).sort(
    (a, b) => Math.abs(a.times - Math.round(a.times)) - Math.abs(b.times - Math.round(b.times)),
  );
  const best = scored.find((c) => c.times >= 0.9) ?? scored[0];
  const times = Math.max(1, Math.round(best.times));
  return [
    {
      type: 'GROUP_STAT',
      memberIds: withDistance.map((m) => m.memberId),
      vars: {
        km: { v: km, f: 'km' },
        comparisonKey: text(best.key),
        times: int(times),
      },
      stats: [{ key: 'groupKm', value: { v: km, f: 'km' } }],
      baseScore: 30,
      provenance: weakest(...withDistance.map((m) => m.provenance)),
      noveltyKey: 'GROUP_STAT',
    },
  ];
};

// ——— Competitive ———————————————————————————————————————————————————————

/** Group record of the month (steps). Manual or implausible values never set records. */
export const recordBroken: Rule = ({ day, history }) => {
  const trusted = day.metrics.filter((m) => m.steps !== undefined && !plausibility(m));
  const previous = Math.max(
    0,
    ...history
      .sameMonth(day.date)
      .flatMap((d) => d.metrics.filter((m) => m.provenance !== 'manual').map((m) => m.steps ?? 0)),
  );
  if (previous === 0) return [];
  const best = trusted.sort((a, b) => (b.steps as number) - (a.steps as number))[0];
  if (!best || (best.steps as number) <= previous) return [];
  return [
    {
      type: 'RECORD_BROKEN',
      memberIds: [best.memberId],
      vars: { value: int(best.steps as number), unit: { v: 'steps', f: 'unit' }, previous: int(previous) },
      stats: [
        { key: 'steps', value: int(best.steps as number) },
        { key: 'previous', value: int(previous) },
      ],
      baseScore: 82,
      provenance: best.provenance,
      noveltyKey: `RECORD:steps:${best.memberId}`,
    },
  ];
};

/** Beat your own all-time best (needs two weeks of history to mean something). */
export const personalRecord: Rule = ({ day, history }) => {
  const out: Candidate[] = [];
  for (const m of day.metrics) {
    if (m.steps === undefined || plausibility(m)) continue;
    const past = history.series(m.memberId, day.date, 3650, (x) => x.steps);
    if (past.length < 14) continue;
    const best = Math.max(...past);
    if (m.steps <= best) continue;
    out.push({
      type: 'PERSONAL_RECORD',
      memberIds: [m.memberId],
      vars: { value: int(m.steps), unit: { v: 'steps', f: 'unit' }, previous: int(best) },
      stats: [
        { key: 'steps', value: int(m.steps) },
        { key: 'previous', value: int(best) },
      ],
      baseScore: 58,
      provenance: m.provenance,
      noveltyKey: `PB:${m.memberId}`,
    });
  }
  return out;
};

/** The announced competition of the day. Always part of the Drop. */
export const todaysBattle: Rule = ({ competition, results, day }) => {
  const podium = results.filter((r) => r.eligible && r.rank > 0).slice(0, 3);
  if (!podium.length) return [];
  const provenance = weakest(
    ...day.metrics.filter((m) => podium.some((p) => p.memberId === m.memberId)).map((m) => m.provenance),
  );
  return [
    {
      type: 'TODAYS_BATTLE',
      memberIds: podium.map((p) => p.memberId),
      vars: { competition: { v: competition.kind, f: 'competition' } },
      stats: [{ key: 'points', value: int(podium[0].points) }],
      baseScore: 70,
      provenance: competition.kind === 'together_time' ? weakest(provenance, 'inferred') : provenance,
      noveltyKey: `BATTLE:${competition.date}`,
      results,
    },
  ];
};

/** Three or more battle wins in a row. */
export const streak: Rule = ({ results, pastMoments, day }) => {
  const winner = results.find((r) => r.rank === 1);
  if (!winner) return [];
  const battles = pastMoments
    .filter((m) => m.type === 'TODAYS_BATTLE')
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  let count = 1;
  for (const b of battles) {
    if (b.results?.find((r) => r.rank === 1)?.memberId === winner.memberId) count++;
    else break;
  }
  if (count < 3) return [];
  return [
    {
      type: 'STREAK',
      memberIds: [winner.memberId],
      vars: { count: int(count) },
      stats: [{ key: 'streak', value: int(count) }],
      baseScore: 60 + count * 4,
      provenance: weakest('inferred', ...day.metrics.filter((m) => m.memberId === winner.memberId).map((m) => m.provenance)),
      noveltyKey: `STREAK:${winner.memberId}`,
    },
  ];
};

export const ALL_RULES: Rule[] = [
  bromance,
  troubleInParadise,
  missing,
  linkUp,
  weirdlyInSync,
  sameMinute,
  musicTwins,
  nightOwl,
  earlyBird,
  sleepChamp,
  homebody,
  explorer,
  photoDump,
  calendarChaos,
  groupStat,
  recordBroken,
  personalRecord,
  todaysBattle,
  streak,
];
