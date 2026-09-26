import { daysBetween } from '@/lib/dates';
import type { DailyMetrics, DayInput, ISODate, MemberId, PairEncounter, Provenance } from '@/domain/types';

export function pairKey(a: MemberId, b: MemberId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Trust order, most trustworthy first. Simulated data is never mixed with real data. */
const TRUST: Provenance[] = ['verified', 'device', 'inferred', 'manual'];

/** The provenance of something computed from several inputs = the weakest input. */
export function weakest(...provenances: Provenance[]): Provenance {
  if (provenances.includes('simulated')) return 'simulated';
  let worst = 0;
  for (const p of provenances) worst = Math.max(worst, TRUST.indexOf(p));
  return TRUST[worst];
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Fast lookups over past days. `days` must be chronological and must NOT include
 * the day being evaluated (rules compare today against the past).
 */
export class HistoryIndex {
  private metrics = new Map<string, DailyMetrics>();
  private pairs = new Map<string, PairEncounter>();

  constructor(readonly days: DayInput[]) {
    for (const day of days) {
      for (const m of day.metrics) this.metrics.set(`${day.date}:${m.memberId}`, m);
      for (const e of day.encounters) this.pairs.set(`${day.date}:${pairKey(e.a, e.b)}`, e);
    }
  }

  metricsOf(memberId: MemberId, date: ISODate): DailyMetrics | undefined {
    return this.metrics.get(`${date}:${memberId}`);
  }

  encounter(a: MemberId, b: MemberId, date: ISODate): PairEncounter | undefined {
    return this.pairs.get(`${date}:${pairKey(a, b)}`);
  }

  /** The `n` most recent days before `date`. */
  recent(date: ISODate, n: number): DayInput[] {
    return this.days.filter((d) => d.date < date && daysBetween(d.date, date) <= n);
  }

  /** Values of a numeric metric for one member over the last `n` days. Manual values are ignored. */
  series(memberId: MemberId, date: ISODate, n: number, pick: (m: DailyMetrics) => number | undefined): number[] {
    const out: number[] = [];
    for (const day of this.recent(date, n)) {
      const m = this.metricsOf(memberId, day.date);
      if (!m || m.provenance === 'manual') continue;
      const v = pick(m);
      if (v !== undefined) out.push(v);
    }
    return out;
  }

  /** Average daily minutes together for a pair over the last `n` days (days without data count as 0). */
  pairAverage(a: MemberId, b: MemberId, date: ISODate, n: number): number {
    const recent = this.recent(date, n);
    if (recent.length === 0) return 0;
    const total = recent.reduce((s, d) => s + (this.encounter(a, b, d.date)?.minutes ?? 0), 0);
    return total / recent.length;
  }

  /** Latest past encounter involving `memberId`. */
  lastEncounterOf(memberId: MemberId): PairEncounter | undefined {
    for (let i = this.days.length - 1; i >= 0; i--) {
      const found = this.days[i].encounters.filter((e) => e.a === memberId || e.b === memberId);
      if (found.length) return found.reduce((x, y) => (y.endedAt > x.endedAt ? y : x));
    }
    return undefined;
  }

  /** Days (inside the same month as `date`, before it). */
  sameMonth(date: ISODate): DayInput[] {
    const month = date.slice(0, 7);
    return this.days.filter((d) => d.date.startsWith(month) && d.date < date);
  }
}
