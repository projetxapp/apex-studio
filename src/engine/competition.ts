import { createRng } from '@/lib/random';
import { daysBetween } from '@/lib/dates';
import type {
  Competition,
  CompetitionKind,
  CompetitionResult,
  DailyMetrics,
  DayInput,
  ISODate,
  Member,
} from '@/domain/types';
import { HistoryIndex, median } from './history';

/**
 * Competitions only use signals every phone can provide (motion) or that every
 * member can opt into for free (time together). Nobody gets an edge from owning a
 * watch or connecting more accounts.
 */
export const COMPETITION_KINDS: CompetitionKind[] = [
  'steps',
  'together_time',
  'beat_your_average',
  'distance',
  'active_minutes',
];

export const POINTS_BY_RANK = [10, 7, 5];
export const PARTICIPATION_POINTS = 2;

/**
 * Deterministic daily competition: a shuffled weekly rotation per League.
 * "Beat your average" needs a week of history, so young Leagues get plain steps instead.
 */
export function competitionFor(date: ISODate, leagueSeed: string, historyDays = Infinity): Competition {
  const index = daysBetween('2026-01-05', date); // a Monday
  const week = Math.floor(index / 7);
  const order = createRng(`${leagueSeed}:week:${week}`).shuffle(COMPETITION_KINDS);
  const dayInWeek = ((index % 7) + 7) % 7;
  const kind = order[dayInWeek % order.length];
  return { date, kind: kind === 'beat_your_average' && historyDays < 7 ? 'steps' : kind };
}

type Check = { value?: number; note?: CompetitionResult['note'] };

/**
 * Plausibility checks. They do not prove anything; they only stop obviously
 * broken or hand-typed numbers from earning points. The value is still shown.
 */
export function plausibility(m: DailyMetrics): CompetitionResult['note'] | undefined {
  if (m.provenance === 'manual') return 'manual';
  if (m.steps !== undefined) {
    if (m.steps > 70_000) return 'suspicious';
    if (m.activeMinutes && m.steps / m.activeMinutes > 220) return 'suspicious';
    if (m.distanceKm !== undefined && m.steps > 1000 && m.distanceKm / (m.steps / 1000) > 1.4) return 'suspicious';
  }
  return undefined;
}

function valueFor(kind: CompetitionKind, member: Member, day: DayInput, history: HistoryIndex): Check {
  const m = day.metrics.find((x) => x.memberId === member.id);
  switch (kind) {
    case 'steps':
      return m?.steps !== undefined ? { value: m.steps, note: plausibility(m) } : { note: 'missing' };
    case 'distance':
      return m?.distanceKm !== undefined ? { value: m.distanceKm, note: plausibility(m) } : { note: 'missing' };
    case 'active_minutes':
      return m?.activeMinutes !== undefined ? { value: m.activeMinutes, note: plausibility(m) } : { note: 'missing' };
    case 'beat_your_average': {
      if (m?.steps === undefined) return { note: 'missing' };
      const past = history.series(member.id, day.date, 14, (x) => x.steps);
      const base = median(past);
      if (past.length < 5 || !base) return { note: 'missing' };
      return { value: Math.round((m.steps / base - 1) * 100), note: plausibility(m) };
    }
    case 'together_time': {
      if (!member.sources.includes('proximity')) return { note: 'missing' };
      const minutes = day.encounters
        .filter((e) => (e.a === member.id || e.b === member.id) && e.provenance !== 'manual')
        .reduce((s, e) => s + e.minutes, 0);
      return { value: minutes };
    }
  }
}

export function scoreCompetition(
  competition: Competition,
  day: DayInput,
  members: Member[],
  history: HistoryIndex,
): CompetitionResult[] {
  const rows = members.map((member) => ({ member, ...valueFor(competition.kind, member, day, history) }));
  const eligible = rows
    .filter((r) => r.value !== undefined && !r.note)
    .sort((a, b) => (b.value as number) - (a.value as number));

  const results: CompetitionResult[] = [];
  let rank = 0;
  let previous: number | undefined;
  eligible.forEach((row, i) => {
    if (row.value !== previous) rank = i + 1;
    previous = row.value;
    results.push({
      memberId: row.member.id,
      value: row.value as number,
      rank,
      points: POINTS_BY_RANK[rank - 1] ?? PARTICIPATION_POINTS,
      eligible: true,
    });
  });
  for (const row of rows) {
    if (row.value !== undefined && !row.note) continue;
    results.push({ memberId: row.member.id, value: row.value ?? 0, rank: 0, points: 0, eligible: false, note: row.note });
  }
  return results;
}
