import { competitionFor, plausibility, scoreCompetition } from '@/engine/competition';
import { HistoryIndex } from '@/engine/history';
import type { DailyMetrics, DayInput, Member } from '@/domain/types';

const member = (id: string, sources: Member['sources'] = ['motion', 'proximity']): Member => ({
  id,
  displayName: id,
  tag: id,
  color: '#fff',
  sources,
});
const metrics = (memberId: string, patch: Partial<DailyMetrics>): DailyMetrics => ({
  memberId,
  date: '2026-09-10',
  provenance: 'device',
  ...patch,
});
const day = (m: DailyMetrics[], encounters: DayInput['encounters'] = []): DayInput => ({
  date: '2026-09-10',
  metrics: m,
  encounters,
  gatherings: [],
});

describe('anti-cheat plausibility', () => {
  it('never lets manual values earn points', () => {
    expect(plausibility(metrics('a', { steps: 9000, provenance: 'manual' }))).toBe('manual');
  });
  it('flags impossible step counts and cadences', () => {
    expect(plausibility(metrics('a', { steps: 120_000 }))).toBe('suspicious');
    expect(plausibility(metrics('a', { steps: 30_000, activeMinutes: 60 }))).toBe('suspicious');
  });
  it('flags distance that does not match steps (e.g. a car ride)', () => {
    expect(plausibility(metrics('a', { steps: 5000, distanceKm: 40 }))).toBe('suspicious');
  });
  it('accepts ordinary days', () => {
    expect(plausibility(metrics('a', { steps: 11_000, distanceKm: 8.1, activeMinutes: 110 }))).toBeUndefined();
  });
});

describe('scoreCompetition', () => {
  const members = [member('a'), member('b'), member('c'), member('d'), member('e', [])];
  const history = new HistoryIndex([]);

  it('ranks eligible members, shares ties and excludes untrusted values', () => {
    const results = scoreCompetition(
      { date: '2026-09-10', kind: 'steps' },
      day([
        metrics('a', { steps: 12_000 }),
        metrics('b', { steps: 12_000 }),
        metrics('c', { steps: 8_000 }),
        metrics('d', { steps: 99_000, provenance: 'manual' }),
      ]),
      members,
      history,
    );
    const by = (id: string) => results.find((r) => r.memberId === id)!;
    expect(by('a').rank).toBe(1);
    expect(by('b').rank).toBe(1);
    expect(by('a').points).toBe(10);
    expect(by('c').rank).toBe(3);
    expect(by('c').points).toBe(5);
    expect(by('d')).toMatchObject({ eligible: false, points: 0, note: 'manual' });
    expect(by('e')).toMatchObject({ eligible: false, note: 'missing' });
  });

  it('only counts time together for members who opted into proximity', () => {
    const results = scoreCompetition(
      { date: '2026-09-10', kind: 'together_time' },
      day([], [{ date: '2026-09-10', a: 'a', b: 'e', minutes: 200, endedAt: 1200, provenance: 'device' }]),
      members,
      history,
    );
    expect(results.find((r) => r.memberId === 'a')?.value).toBe(200);
    expect(results.find((r) => r.memberId === 'e')?.note).toBe('missing');
  });
});

describe('competitionFor', () => {
  it('is deterministic per League and date', () => {
    expect(competitionFor('2026-09-10', 'x')).toEqual(competitionFor('2026-09-10', 'x'));
  });
  it('does not schedule "beat your average" for brand-new Leagues', () => {
    for (let d = 1; d <= 28; d++) {
      const date = `2026-09-${String(d).padStart(2, '0')}`;
      expect(competitionFor(date, 'new-league', 0).kind).not.toBe('beat_your_average');
    }
  });
});
