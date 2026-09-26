import { isWeekend, weekday } from '@/lib/dates';
import { createRng } from '@/lib/random';
import { pairKey } from '@/engine/history';
import type { DailyMetrics, DayInput, Gathering, ISODate, Member, PairEncounter } from '@/domain/types';
import { AFFINITIES, DEFAULT_AFFINITY, PERSONAS, TOM_AFFINITY } from './members';
import { SCENARIO } from './scenario';

/**
 * Fake-data generator for the demo League.
 * Deterministic: a given date always produces the same day. Every value is tagged
 * `provenance: 'simulated'` so it can never be confused with a real measurement.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Ordinary days never exceed this, so scripted records stay records. */
const ORDINARY_STEPS_CAP = 17_900;

function memberMetrics(member: Member, date: ISODate, allowBreakout: boolean): DailyMetrics {
  const p = PERSONAS[member.id];
  const rng = createRng(`demo:${date}:${member.id}`);
  const has = (s: Member['sources'][number]) => member.sources.includes(s);
  const weekend = isWeekend(date);
  const homebody = rng.chance(p.homebodyChance * (weekend ? 1.8 : 1));

  let steps = rng.normal(p.stepsMean * (weekend ? 0.92 : 1), p.stepsSd);
  if (homebody) steps *= 0.3;
  steps = Math.max(900, Math.round(steps));
  if (steps > ORDINARY_STEPS_CAP) steps = ORDINARY_STEPS_CAP - rng.int(0, 1400);
  if (allowBreakout && !homebody && rng.chance(0.04)) steps = Math.round(steps * 1.45);

  const m: DailyMetrics = { memberId: member.id, date, provenance: 'simulated' };
  if (has('motion')) {
    m.steps = steps;
    m.distanceKm = Math.round(steps * rng.normal(0.00074, 0.00003) * 10) / 10;
    m.activeMinutes = Math.max(5, Math.round(steps / 105 + rng.normal(0, 8)));
  }
  if (has('sleep')) {
    const late = weekend && weekday(date) === 6 ? 50 : weekend ? 30 : 0;
    m.bedtime = Math.round(rng.normal(p.bedtime + late, 32));
    m.wakeTime = Math.round(rng.normal(p.wake + (weekend ? 55 : 0), 24));
    m.sleepMinutes = m.wakeTime + 1440 - m.bedtime - rng.int(5, 25);
  }
  if (has('routine')) {
    if (homebody) {
      m.placesVisited = 0;
    } else {
      m.leftHomeAt = Math.round(rng.normal(p.leave + (weekend ? 90 : 0), 22));
      m.returnedHomeAt = Math.round(rng.normal(p.back + (weekend ? 60 : 0), 40));
      m.placesVisited = clamp(Math.round(rng.normal(p.places, 1.6)), 1, 9);
    }
  }
  if (has('music') && p.artists.length) {
    m.topArtist = rng.chance(0.55) ? p.artists[0] : rng.pick(p.artists);
    m.musicMinutes = clamp(Math.round(rng.normal(75, 35)), 5, 300);
  }
  if (has('photos')) {
    const spike = rng.chance(0.05) ? 3.5 : 1;
    m.photosTaken = clamp(Math.round(rng.normal(p.photos, p.photos * 0.5) * spike), 0, 400);
  }
  if (has('calendar')) {
    m.calendarEvents = clamp(Math.round(rng.normal(p.calendar * (weekend ? 0.4 : 1), 1.3)), 0, 12);
  }
  return m;
}

function encountersFor(members: Member[], date: ISODate): PairEncounter[] {
  const rng = createRng(`demo:${date}:pairs`);
  const out: PairEncounter[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i].id;
      const b = members[j].id;
      const known = AFFINITIES.find((x) => pairKey(x.a, x.b) === pairKey(a, b));
      const aff = known ?? (a === 'tom' || b === 'tom' ? TOM_AFFINITY : DEFAULT_AFFINITY);
      const weekendBoost = isWeekend(date) ? 1.15 : 1;
      if (!rng.chance(Math.min(0.95, aff.p * weekendBoost))) continue;
      out.push({
        date,
        a: a < b ? a : b,
        b: a < b ? b : a,
        minutes: clamp(Math.round(rng.normal(aff.minutes, aff.minutes * 0.38)), 12, 360),
        endedAt: clamp(Math.round(rng.normal(18 * 60 + 30, 80)), 10 * 60, 20 * 60 + 50),
        provenance: 'simulated',
      });
    }
  }
  return out;
}

function gatheringFor(members: Member[], date: ISODate): Gathering[] {
  const w = weekday(date);
  if (w !== 5 && w !== 6) return [];
  const rng = createRng(`demo:${date}:gathering`);
  if (!rng.chance(0.5)) return [];
  const size = rng.int(4, 6);
  const ids = rng.shuffle(members.filter((m) => m.id !== 'tom').map((m) => m.id)).slice(0, size);
  return [{ date, memberIds: ids, minutes: rng.int(80, 200), provenance: 'simulated' }];
}

/** Gatherings imply pairwise time together for everyone present. */
function mergeGatherings(encounters: PairEncounter[], gatherings: Gathering[]): PairEncounter[] {
  const byKey = new Map(encounters.map((e) => [pairKey(e.a, e.b), { ...e }]));
  for (const g of gatherings) {
    for (let i = 0; i < g.memberIds.length; i++) {
      for (let j = i + 1; j < g.memberIds.length; j++) {
        const [a, b] = [g.memberIds[i], g.memberIds[j]].sort();
        const key = pairKey(a, b);
        const cur = byKey.get(key);
        if (cur) {
          cur.minutes = Math.max(cur.minutes, g.minutes) + Math.round(cur.minutes * 0.3);
          cur.endedAt = Math.max(cur.endedAt, 20 * 60 + 30);
        } else {
          byKey.set(key, { date: g.date, a, b, minutes: g.minutes, endedAt: 20 * 60 + 30, provenance: 'simulated' });
        }
      }
    }
  }
  return [...byKey.values()].sort((x, y) => pairKey(x.a, x.b).localeCompare(pairKey(y.a, y.b)));
}

/**
 * Generates one simulated day. `allowBreakouts` lets future (user-advanced) days
 * produce surprise records.
 */
export function generateDay(members: Member[], date: ISODate, allowBreakouts = false): DayInput {
  const metrics = members.map((m) => memberMetrics(m, date, allowBreakouts));
  let encounters = encountersFor(members, date);
  let gatherings = gatheringFor(members, date);
  const script = SCENARIO[date];
  if (script?.gatherings) gatherings = script.gatherings.map((g) => ({ ...g, date, provenance: 'simulated' as const }));
  encounters = mergeGatherings(encounters, gatherings);
  let day: DayInput = { date, metrics, encounters, gatherings };
  if (script) day = script.apply(day);
  return day;
}
