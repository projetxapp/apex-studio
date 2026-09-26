import { addDays, dateRange, endOfMonth, monthOf } from '@/lib/dates';
import { createRng } from '@/lib/random';
import { competitionFor } from '@/engine/competition';
import { runDays, type DayOutput } from '@/engine/engine';
import { computeAwards, computeRecap, computeRecords, computeStandings, pairTotals, seasonFor } from '@/engine/season';
import type { DayInput, ISODate, MemberId, Reaction, ReactionEmoji } from '@/domain/types';
import { REACTIONS } from '@/domain/types';
import { DROP_REVEAL_MINUTE, type LeagueSnapshot } from '@/data/snapshot';
import { generateDay } from './generator';
import { DEMO_MEMBERS } from './members';
import { DEMO_FIRST_DAY, DEMO_TODAY } from './scenario';

export const DEMO_LEAGUE_SEED = 'demo-league';

export interface DemoState {
  /** The simulated "today". Starts at DEMO_TODAY and moves forward with "next day". */
  date: ISODate;
  /** Whether today's Drop has been revealed early. */
  revealed: boolean;
  /** Which fictional member the viewer plays as. */
  meId: MemberId;
  /** The viewer's own reactions, keyed by moment id. */
  myReactions: Record<string, ReactionEmoji>;
}

export const DEFAULT_DEMO_STATE: DemoState = {
  date: DEMO_TODAY,
  revealed: false,
  meId: 'hippolyte',
  myReactions: {},
};

/** Maximum number of days the demo can be advanced (keeps things snappy). */
export const DEMO_MAX_DAYS_AHEAD = 45;

interface Simulation {
  days: DayInput[];
  outputs: DayOutput[];
}

let cached: { upTo: ISODate; sim: Simulation } | null = null;

/** Generates every simulated day up to `upTo` and runs the Moment Engine over them. */
export function simulate(upTo: ISODate): Simulation {
  if (cached?.upTo === upTo) return cached.sim;
  const days = dateRange(DEMO_FIRST_DAY, upTo).map((d) => generateDay(DEMO_MEMBERS, d, d > DEMO_TODAY));
  const outputs = runDays(days, DEMO_MEMBERS, { leagueSeed: DEMO_LEAGUE_SEED });
  const sim = { days, outputs };
  cached = { upTo, sim };
  return sim;
}

const FAKE_REACTION_WEIGHTS: ReactionEmoji[] = ['😂', '😂', '😂', '🔥', '🔥', '💀', '💀', '👀', '🫶'];

function fakeReactions(momentId: string, meId: MemberId): Reaction[] {
  const rng = createRng(`reactions:${momentId}`);
  const others = rng.shuffle(DEMO_MEMBERS.filter((m) => m.id !== meId));
  return others.slice(0, rng.int(1, 6)).map((m) => ({ momentId, memberId: m.id, emoji: rng.pick(FAKE_REACTION_WEIGHTS) }));
}

export function buildDemoSnapshot(state: DemoState): LeagueSnapshot {
  const today = state.date;
  const { days, outputs } = simulate(today);
  const visible = outputs.filter((o) => o.date < today || (o.date === today && state.revealed));
  const todayOutput = outputs.find((o) => o.date === today);

  const season = seasonFor(today, today);
  const month = monthOf(today);
  const seasonOutputs = visible.filter((o) => monthOf(o.date) === month);
  const visibleDates = new Set(visible.map((o) => o.date));
  const visibleDays = days.filter((d) => visibleDates.has(d.date));
  const seasonDays = visibleDays.filter((d) => monthOf(d.date) === month);
  const standings = computeStandings(seasonOutputs, DEMO_MEMBERS);

  const pastMonths = [...new Set(visible.map((o) => monthOf(o.date)))].filter((m) => m < month).sort().reverse();
  const pastSeasons = pastMonths.map((m) => {
    const s = seasonFor(`${m}-01`, today);
    return computeRecap(
      s,
      visibleDays.filter((d) => monthOf(d.date) === m),
      visible.filter((o) => monthOf(o.date) === m),
      visibleDays.filter((d) => d.date <= endOfMonth(`${m}-01`)),
      DEMO_MEMBERS,
    );
  });

  const drops = [...visible].reverse().map((o) => ({
    date: o.date,
    competition: o.competition,
    moments: o.moments,
    revealed: true,
  }));

  const reactions: Reaction[] = [];
  for (const drop of drops.slice(0, 21)) {
    for (const moment of drop.moments) {
      reactions.push(...fakeReactions(moment.id, state.meId));
      const mine = state.myReactions[moment.id];
      if (mine) reactions.push({ momentId: moment.id, memberId: state.meId, emoji: mine });
    }
  }

  return {
    mode: 'demo',
    league: { id: 'demo', name: 'Les Légendes', inviteCode: 'DEMO2026', timezone: 'Europe/Paris', isSimulated: true },
    meId: state.meId,
    members: DEMO_MEMBERS,
    today: {
      date: today,
      competition: todayOutput?.competition ?? competitionFor(today, DEMO_LEAGUE_SEED),
      participants: DEMO_MEMBERS.filter((m) => m.sources.includes('motion')).length,
      revealAt: DROP_REVEAL_MINUTE,
      revealed: state.revealed,
      pendingMoments: state.revealed ? 0 : (todayOutput?.moments.length ?? 0),
    },
    drops,
    season,
    standings,
    records: computeRecords(seasonDays, visibleDays, DEMO_MEMBERS),
    awards: computeAwards(seasonDays, seasonOutputs, DEMO_MEMBERS, standings),
    pastSeasons,
    pairMinutes: [...pairTotals(seasonDays).values()],
    reactions,
  };
}

export function nextDemoState(state: DemoState): DemoState {
  const limit = addDays(DEMO_TODAY, DEMO_MAX_DAYS_AHEAD);
  const date = state.date < limit ? addDays(state.date, 1) : state.date;
  return { ...state, date, revealed: false };
}

export { REACTIONS };
