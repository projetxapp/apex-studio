import { pairKey } from '@/engine/history';
import type { DailyMetrics, DayInput, Gathering, ISODate, MemberId, PairEncounter } from '@/domain/types';

/**
 * Hand-written storylines layered on top of the random generator, so the demo
 * reliably shows the signature moments (BROMANCE 6h14, MISSING Tom, the big LINK-UP…).
 * Still 100 % fictional.
 */

type Script = {
  gatherings?: Omit<Gathering, 'date' | 'provenance'>[];
  apply: (day: DayInput) => DayInput;
};

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

function setMetrics(day: DayInput, id: MemberId, patch: Partial<DailyMetrics>): DayInput {
  return { ...day, metrics: day.metrics.map((m) => (m.memberId === id ? { ...m, ...patch } : m)) };
}

function setEncounter(day: DayInput, a: MemberId, b: MemberId, minutes: number, endedAt = h(20)): DayInput {
  const key = pairKey(a, b);
  const others = day.encounters.filter((e) => pairKey(e.a, e.b) !== key);
  const [x, y] = [a, b].sort();
  const e: PairEncounter = { date: day.date, a: x, b: y, minutes, endedAt, provenance: 'simulated' };
  return { ...day, encounters: [...others, e] };
}

function isolate(day: DayInput, id: MemberId): DayInput {
  return { ...day, encounters: day.encounters.filter((e) => e.a !== id && e.b !== id) };
}

/** Demo "today". The demo starts here; users can simulate the following days. */
export const DEMO_TODAY: ISODate = '2026-09-26';
export const DEMO_FIRST_DAY: ISODate = '2026-08-01';

const pipe =
  (...fns: ((d: DayInput) => DayInput)[]) =>
  (d: DayInput) =>
    fns.reduce((acc, f) => f(acc), d);

export const SCENARIO: Record<ISODate, Script> = {
  '2026-09-08': { apply: (d) => setMetrics(d, 'pitouf', { photosTaken: 212 }) },
  '2026-09-12': { apply: (d) => setMetrics(d, 'maulus', { bedtime: h(27, 47), sleepMinutes: 355 }) },
  '2026-09-19': {
    gatherings: [{ memberIds: ['hippolyte', 'joseph', 'arthur', 'flora', 'zenou', 'maulus'], minutes: 222 }],
    apply: (d) => d,
  },
  '2026-09-22': { apply: (d) => setMetrics(d, 'joseph', { steps: 18_492, distanceKm: 13.8, activeMinutes: 171 }) },
  '2026-09-24': {
    apply: pipe(
      (d) => setEncounter(d, 'hippolyte', 'joseph', 374, h(20, 40)),
      (d) => isolate(d, 'tom'),
      (d) => setEncounter(d, 'arthur', 'tom', 45, h(19, 0)),
    ),
  },
  '2026-09-25': {
    apply: pipe(
      (d) => setEncounter(d, 'hippolyte', 'joseph', 4, h(13, 10)),
      (d) => isolate(d, 'tom'),
      (d) => setMetrics(d, 'arthur', { leftHomeAt: h(8, 2), returnedHomeAt: h(18, 41), placesVisited: 3 }),
      (d) => setMetrics(d, 'tom', { leftHomeAt: h(8, 5), returnedHomeAt: h(18, 48), placesVisited: 3 }),
    ),
  },
  '2026-09-26': {
    apply: pipe(
      (d) => setMetrics(d, 'flora', { steps: 21_030, distanceKm: 15.6, activeMinutes: 188 }),
      (d) => setMetrics(d, 'maulus', { wakeTime: h(10, 12), topArtist: 'PNL' }),
      (d) => setMetrics(d, 'pitouf', { wakeTime: h(10, 12) }),
      (d) => setMetrics(d, 'hippolyte', { topArtist: 'PNL' }),
      (d) => setMetrics(d, 'joseph', { topArtist: 'PNL' }),
      (d) => setEncounter(d, 'hippolyte', 'joseph', 205, h(20, 30)),
    ),
  },
};
