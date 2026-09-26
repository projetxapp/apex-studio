import { runDay, selectMoments } from '@/engine/engine';
import { HistoryIndex } from '@/engine/history';
import { bromance, weirdlyInSync, type Candidate } from '@/engine/rules';
import { formatClock, formatDuration, formatInt } from '@/lib/format';
import type { DayInput, Member } from '@/domain/types';

const members: Member[] = ['a', 'b', 'c'].map((id) => ({
  id,
  displayName: id.toUpperCase(),
  tag: id,
  color: '#fff',
  sources: ['motion', 'routine', 'proximity', 'sleep'],
}));

const baseDay = (patch: Partial<DayInput> = {}): DayInput => ({
  date: '2026-09-10',
  metrics: [],
  encounters: [],
  gatherings: [],
  ...patch,
});

const ctx = (day: DayInput) => ({
  day,
  history: new HistoryIndex([]),
  members,
  competition: { date: day.date, kind: 'steps' as const },
  results: [],
  pastMoments: [],
});

describe('rules', () => {
  it('BROMANCE needs a long stretch together, and never trusts manual data', () => {
    const short = baseDay({ encounters: [{ date: '2026-09-10', a: 'a', b: 'b', minutes: 90, endedAt: 1200, provenance: 'device' }] });
    expect(bromance(ctx(short))).toHaveLength(0);
    const manual = baseDay({ encounters: [{ date: '2026-09-10', a: 'a', b: 'b', minutes: 400, endedAt: 1200, provenance: 'manual' }] });
    expect(bromance(ctx(manual))).toHaveLength(0);
    const long = baseDay({ encounters: [{ date: '2026-09-10', a: 'a', b: 'b', minutes: 374, endedAt: 1200, provenance: 'device' }] });
    expect(bromance(ctx(long))[0].vars.minutes.v).toBe(374);
  });

  it('WEIRDLY IN SYNC ignores pairs who simply spent the day together', () => {
    const metrics = [
      { memberId: 'a', date: '2026-09-10', provenance: 'device' as const, leftHomeAt: 480, returnedHomeAt: 1120 },
      { memberId: 'b', date: '2026-09-10', provenance: 'device' as const, leftHomeAt: 483, returnedHomeAt: 1127 },
    ];
    expect(weirdlyInSync(ctx(baseDay({ metrics })))).toHaveLength(1);
    const together = baseDay({
      metrics,
      encounters: [{ date: '2026-09-10', a: 'a', b: 'b', minutes: 300, endedAt: 1100, provenance: 'device' }],
    });
    expect(weirdlyInSync(ctx(together))).toHaveLength(0);
  });
});

describe('selection', () => {
  const cand = (type: Candidate['type'], score: number, ids = ['a']): Candidate & { score: number } => ({
    type,
    memberIds: ids,
    vars: {},
    stats: [],
    baseScore: score,
    score,
    provenance: 'device',
    noveltyKey: `${type}:${ids.join('|')}`,
  });

  it('keeps the battle last and caps competitive cards', () => {
    const picked = selectMoments([
      cand('TODAYS_BATTLE', 70),
      cand('RECORD_BROKEN', 90, ['b']),
      cand('PERSONAL_RECORD', 85, ['c']),
      cand('STREAK', 80, ['a']),
      cand('BROMANCE', 60, ['b', 'c']),
    ]);
    expect(picked[picked.length - 1].type).toBe('TODAYS_BATTLE');
    expect(picked.filter((c) => ['RECORD_BROKEN', 'PERSONAL_RECORD', 'STREAK', 'TODAYS_BATTLE'].includes(c.type))).toHaveLength(2);
  });

  it('works without any data (empty League)', () => {
    const out = runDay(baseDay(), new HistoryIndex([]), members, [], { leagueSeed: 'x' });
    expect(out.moments).toEqual([]);
  });
});

describe('formatting', () => {
  it('formats French durations, clocks and numbers', () => {
    expect(formatDuration(374)).toBe('6h14');
    expect(formatDuration(4)).toBe('4 min');
    expect(formatClock(1440 + 107)).toBe('01h47');
    expect(formatInt(18492)).toBe('18 492');
  });
});
