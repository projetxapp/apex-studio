import { endOfMonth, monthOf, startOfMonth } from '@/lib/dates';
import type {
  Award,
  DayInput,
  Member,
  MemberId,
  Moment,
  RecordEntry,
  Season,
  SeasonRecap,
  Standing,
} from '@/domain/types';
import { plausibility } from './competition';
import type { DayOutput } from './engine';
import { mean, pairKey } from './history';

/**
 * Seasons = calendar months. Season points come only from the daily battle;
 * every other moment is for fun. Lifetime stats survive the reset.
 */

export function seasonFor(date: string, today: string): Season {
  const month = monthOf(date);
  return {
    id: month,
    month,
    startsOn: startOfMonth(date),
    endsOn: endOfMonth(date),
    status: endOfMonth(date) < today ? 'closed' : 'active',
  };
}

function rank<T extends { memberId: MemberId; points: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.memberId.localeCompare(b.memberId));
  let r = 0;
  let prev: number | undefined;
  return sorted.map((row, i) => {
    if (row.points !== prev) r = i + 1;
    prev = row.points;
    return { ...row, rank: r };
  });
}

/** Standings for the season containing `outputs` (already filtered to that month and revealed days). */
export function computeStandings(outputs: DayOutput[], members: Member[]): Standing[] {
  const tally = (list: DayOutput[]) => {
    const points = new Map<MemberId, number>(members.map((m) => [m.id, 0]));
    const wins = new Map<MemberId, number>(members.map((m) => [m.id, 0]));
    for (const out of list) {
      for (const r of out.results) {
        if (!points.has(r.memberId)) continue;
        points.set(r.memberId, (points.get(r.memberId) ?? 0) + r.points);
        if (r.rank === 1) wins.set(r.memberId, (wins.get(r.memberId) ?? 0) + 1);
      }
    }
    return rank(members.map((m) => ({ memberId: m.id, points: points.get(m.id) ?? 0, wins: wins.get(m.id) ?? 0 })));
  };
  const now = tally(outputs);
  const before = tally(outputs.slice(0, -1));
  return now.map((row) => {
    const prev = before.find((b) => b.memberId === row.memberId);
    return { ...row, delta: outputs.length > 1 && prev ? prev.rank - row.rank : 0 };
  });
}

/** Total minutes together per pair over the given days. */
export function pairTotals(days: DayInput[]): Map<string, { a: MemberId; b: MemberId; minutes: number }> {
  const totals = new Map<string, { a: MemberId; b: MemberId; minutes: number }>();
  for (const day of days) {
    for (const e of day.encounters) {
      const key = pairKey(e.a, e.b);
      const cur = totals.get(key) ?? { a: e.a < e.b ? e.a : e.b, b: e.a < e.b ? e.b : e.a, minutes: 0 };
      cur.minutes += e.minutes;
      totals.set(key, cur);
    }
  }
  return totals;
}

/** Group records over `days`, plus all-time personal step records over `allDays`. */
export function computeRecords(days: DayInput[], allDays: DayInput[], members: Member[]): RecordEntry[] {
  const records: RecordEntry[] = [];
  const trusted = days.flatMap((d) => d.metrics.filter((m) => !plausibility(m)));

  const bestSteps = trusted.filter((m) => m.steps !== undefined).sort((a, b) => (b.steps as number) - (a.steps as number))[0];
  if (bestSteps)
    records.push({ id: 'steps_day', scope: 'group', key: 'steps_day', memberIds: [bestSteps.memberId], value: { v: bestSteps.steps as number, f: 'int' }, date: bestSteps.date });

  const bestKm = trusted.filter((m) => m.distanceKm !== undefined).sort((a, b) => (b.distanceKm as number) - (a.distanceKm as number))[0];
  if (bestKm)
    records.push({ id: 'distance_day', scope: 'group', key: 'distance_day', memberIds: [bestKm.memberId], value: { v: bestKm.distanceKm as number, f: 'km' }, date: bestKm.date });

  const bestDuo = days.flatMap((d) => d.encounters).sort((a, b) => b.minutes - a.minutes)[0];
  if (bestDuo)
    records.push({ id: 'duo_day', scope: 'group', key: 'duo_day', memberIds: [bestDuo.a, bestDuo.b], value: { v: bestDuo.minutes, f: 'duration' }, date: bestDuo.date });

  const bestGathering = days
    .flatMap((d) => d.gatherings)
    .sort((a, b) => b.memberIds.length * b.minutes - a.memberIds.length * a.minutes)[0];
  if (bestGathering)
    records.push({
      id: 'gathering',
      scope: 'group',
      key: 'gathering',
      memberIds: bestGathering.memberIds,
      value: { v: `${bestGathering.memberIds.length} · ${Math.floor(bestGathering.minutes / 60)}h${String(bestGathering.minutes % 60).padStart(2, '0')}`, f: 'text' },
      date: bestGathering.date,
    });

  const latest = days
    .flatMap((d) => d.metrics)
    .filter((m) => m.bedtime !== undefined)
    .sort((a, b) => (b.bedtime as number) - (a.bedtime as number))[0];
  if (latest)
    records.push({ id: 'latest_bedtime', scope: 'group', key: 'latest_bedtime', memberIds: [latest.memberId], value: { v: latest.bedtime as number, f: 'clock' }, date: latest.date });

  const allTrusted = allDays.flatMap((d) => d.metrics.filter((m) => !plausibility(m) && m.steps !== undefined));
  for (const member of members) {
    const best = allTrusted.filter((m) => m.memberId === member.id).sort((a, b) => (b.steps as number) - (a.steps as number))[0];
    if (best)
      records.push({ id: `pb:${member.id}`, scope: 'personal', key: 'personal_steps', memberIds: [member.id], value: { v: best.steps as number, f: 'int' }, date: best.date });
  }
  return records;
}

function topBy(members: Member[], score: (id: MemberId) => number, min = 1): { id: MemberId; value: number } | null {
  const rows = members.map((m) => ({ id: m.id, value: score(m.id) })).sort((a, b) => b.value - a.value);
  return rows[0] && rows[0].value >= min ? rows[0] : null;
}

export function computeAwards(
  days: DayInput[],
  outputs: DayOutput[],
  members: Member[],
  standings: Standing[],
): Award[] {
  const awards: Award[] = [];
  const moments: Moment[] = outputs.flatMap((o) => o.moments);
  const sum = (id: MemberId, pick: (m: DayInput['metrics'][number]) => number | undefined) =>
    days.reduce((s, d) => {
      const m = d.metrics.find((x) => x.memberId === id);
      return s + (m ? (pick(m) ?? 0) : 0);
    }, 0);

  const leader = standings[0];
  if (leader && leader.points > 0)
    awards.push({ id: 'champion', key: 'champion', memberIds: [leader.memberId], value: { v: leader.points, f: 'int' }, competitive: true });

  const steps = topBy(members, (id) => sum(id, (m) => (plausibility(m) ? 0 : m.steps)));
  if (steps) awards.push({ id: 'steps_king', key: 'steps_king', memberIds: [steps.id], value: { v: steps.value, f: 'int' }, competitive: true });

  const duo = [...pairTotals(days).values()].sort((a, b) => b.minutes - a.minutes)[0];
  if (duo) awards.push({ id: 'iconic_duo', key: 'iconic_duo', memberIds: [duo.a, duo.b], value: { v: duo.minutes, f: 'duration' }, competitive: false });

  const social = topBy(members, (id) =>
    days.reduce((s, d) => s + d.encounters.filter((e) => e.a === id || e.b === id).reduce((x, e) => x + e.minutes, 0), 0),
  );
  if (social) awards.push({ id: 'social_butterfly', key: 'social_butterfly', memberIds: [social.id], value: { v: social.value, f: 'duration' }, competitive: false });

  const ghost = topBy(members, (id) => moments.filter((m) => m.type === 'MISSING' && m.memberIds[0] === id).length);
  if (ghost) awards.push({ id: 'ghost', key: 'ghost', memberIds: [ghost.id], value: { v: ghost.value, f: 'int' }, competitive: false });

  const owl = topBy(
    members,
    (id) => mean(days.flatMap((d) => d.metrics.filter((m) => m.memberId === id && m.bedtime !== undefined).map((m) => m.bedtime as number))) ?? 0,
  );
  if (owl) awards.push({ id: 'night_owl', key: 'night_owl', memberIds: [owl.id], value: { v: Math.round(owl.value), f: 'clock' }, competitive: false });

  const photos = topBy(members, (id) => sum(id, (m) => m.photosTaken));
  if (photos) awards.push({ id: 'photographer', key: 'photographer', memberIds: [photos.id], value: { v: photos.value, f: 'int' }, competitive: false });

  const home = topBy(members, (id) =>
    days.filter((d) => d.metrics.some((m) => m.memberId === id && m.placesVisited === 0 && m.leftHomeAt === undefined)).length,
  );
  if (home) awards.push({ id: 'homebody', key: 'homebody', memberIds: [home.id], value: { v: home.value, f: 'int' }, competitive: false });

  const minister = topBy(members, (id) => sum(id, (m) => m.calendarEvents));
  if (minister) awards.push({ id: 'minister', key: 'minister', memberIds: [minister.id], value: { v: minister.value, f: 'int' }, competitive: false });

  return awards;
}

export function computeRecap(
  season: Season,
  days: DayInput[],
  outputs: DayOutput[],
  allDays: DayInput[],
  members: Member[],
): SeasonRecap {
  const standings = computeStandings(outputs, members);
  const duo = [...pairTotals(days).values()].sort((a, b) => b.minutes - a.minutes)[0] ?? null;
  const moments = outputs.flatMap((o) => o.moments);
  const unexpectedTypes = new Set(['WEIRDLY_IN_SYNC', 'SAME_MINUTE', 'TROUBLE_IN_PARADISE', 'MUSIC_TWINS', 'RECORD_BROKEN']);
  return {
    season,
    standings,
    championId: standings[0]?.points ? standings[0].memberId : null,
    awards: computeAwards(days, outputs, members, standings),
    records: computeRecords(days, allDays, members).filter((r) => r.scope === 'group'),
    iconicDuo: duo,
    unexpected: moments
      .filter((m) => unexpectedTypes.has(m.type))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4),
    totals: {
      moments: moments.length,
      steps: days.reduce((s, d) => s + d.metrics.reduce((x, m) => x + (m.steps ?? 0), 0), 0),
      minutesTogether: days.reduce((s, d) => s + d.encounters.reduce((x, e) => x + e.minutes, 0), 0),
    },
  };
}
