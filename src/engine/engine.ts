import { fr } from '@/i18n/fr';
import { daysBetween } from '@/lib/dates';
import { createRng } from '@/lib/random';
import type { Competition, CompetitionResult, DayInput, Member, Moment } from '@/domain/types';
import { MOMENT_CATALOG } from './catalog';
import { competitionFor, scoreCompetition } from './competition';
import { HistoryIndex } from './history';
import { ALL_RULES, type Candidate, type Rule } from './rules';

/**
 * THE MOMENT ENGINE
 *
 * 1. Score the day's competition.
 * 2. Run every rule → candidates with a base interest score.
 * 3. Penalise what the group has seen recently (same pair, same type…) and reward rare moments.
 * 4. Pick a varied set: ~70 % social/facts, ~30 % competitive, one card per type,
 *    nobody hogging the Drop.
 * 5. Pick caption variants, avoiding the ones used recently.
 *
 * Fully deterministic: the same inputs always produce the same Drop.
 */

export interface EngineOptions {
  leagueSeed: string;
  maxMoments?: number;
  /** Quiet days still get at least this many cards when enough candidates exist. */
  minMoments?: number;
  /** Target share of competitive cards (guideline, not a hard rule). */
  competitiveShare?: number;
  minScore?: number;
  rules?: Rule[];
}

export interface DayOutput {
  date: string;
  competition: Competition;
  results: CompetitionResult[];
  moments: Moment[];
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const NOVELTY_WINDOW = 10;

export function noveltyScore(candidate: Candidate, date: string, past: Moment[]): number {
  if (candidate.type === 'TODAYS_BATTLE') return candidate.baseScore;
  let sameKey = 0; // penalty from the most recent identical moment
  let repeats = 0; // extra identical moments in the window
  let sameType = 0; // most recent moment of the same type (other people)
  for (const m of past) {
    const age = daysBetween(m.date, date);
    if (age <= 0 || age > NOVELTY_WINDOW) continue;
    const fade = 1 - age / (NOVELTY_WINDOW + 1);
    if (m.noveltyKey === candidate.noveltyKey) {
      if (sameKey > 0) repeats++;
      sameKey = Math.max(sameKey, 24 * fade);
    } else if (m.type === candidate.type) {
      sameType = Math.max(sameType, 8 * fade);
    }
  }
  const fresh = sameKey === 0 && sameType === 0 ? 6 : 0;
  return clamp(candidate.baseScore - sameKey - repeats * 4 - sameType + fresh);
}

/** Headline × quip variant, avoiding quips this type used in its last appearances. */
function chooseVariant(candidate: Candidate, date: string, seed: string, past: Moment[]): number {
  const copy = fr.moments[candidate.type];
  const H = copy.headlines.length;
  const Q = copy.quips.length;
  const recentQuips = past
    .filter((m) => m.type === candidate.type)
    .slice(-Math.max(1, Q - 1))
    .map((m) => Math.floor(m.variant / H) % Q);
  const recentHeadlines = past
    .filter((m) => m.type === candidate.type)
    .slice(-1)
    .map((m) => m.variant % H);
  const rng = createRng(`${seed}:${date}:${candidate.noveltyKey}`);
  const quips = rng.shuffle([...Array(Q).keys()]);
  const quip = quips.find((q) => !recentQuips.includes(q)) ?? quips[0];
  const headlines = rng.shuffle([...Array(H).keys()]);
  const headline = headlines.find((h) => !recentHeadlines.includes(h)) ?? headlines[0];
  return headline + H * quip;
}

export function selectMoments(
  candidates: (Candidate & { score: number })[],
  { maxMoments = 8, minMoments = 4, competitiveShare = 0.3, minScore = 25 }: Partial<EngineOptions> = {},
): (Candidate & { score: number })[] {
  const battle = candidates.find((c) => c.type === 'TODAYS_BATTLE');
  const ranked = candidates
    .filter((c) => c !== battle)
    .sort((a, b) => b.score - a.score || a.noveltyKey.localeCompare(b.noveltyKey));

  const competitiveQuota = Math.max(1, Math.round(maxMoments * competitiveShare));
  const picked: (Candidate & { score: number })[] = battle ? [battle] : [];
  const types = new Set(picked.map((c) => c.type));
  const appearances = new Map<string, number>();
  const bump = (c: Candidate) => {
    if (c.memberIds.length > 3) return; // crowd cards don't count
    for (const id of c.memberIds) appearances.set(id, (appearances.get(id) ?? 0) + 1);
  };
  picked.forEach(bump);
  let competitive = picked.length;

  const pass = (strict: boolean, limit: number) => {
    for (const c of ranked) {
      if (picked.length >= limit) break;
      if (picked.includes(c) || types.has(c.type)) continue;
      if (strict && c.score < minScore) continue;
      const isCompetitive = MOMENT_CATALOG[c.type].category === 'competitive';
      if (isCompetitive && competitive >= competitiveQuota) continue;
      const cap = strict ? 2 : 3;
      if (c.memberIds.length <= 3 && c.memberIds.some((id) => (appearances.get(id) ?? 0) >= cap)) continue;
      picked.push(c);
      types.add(c.type);
      bump(c);
      if (isCompetitive) competitive++;
    }
  };
  pass(true, maxMoments);
  // Quiet day: top up with the best of what is left, even if it was seen recently.
  if (picked.length < minMoments) pass(false, minMoments);

  // Story order: strongest moment first, the day's battle as the finale.
  const rest = picked.filter((c) => c !== battle).sort((a, b) => b.score - a.score);
  return battle ? [...rest, battle] : rest;
}

export function runDay(
  day: DayInput,
  history: HistoryIndex,
  members: Member[],
  pastMoments: Moment[],
  options: EngineOptions,
): DayOutput {
  const competition = competitionFor(day.date, options.leagueSeed, history.days.length);
  const results = scoreCompetition(competition, day, members, history);
  const rules = options.rules ?? ALL_RULES;
  const ctx = { day, history, members, competition, results, pastMoments };
  const candidates = rules.flatMap((rule) => rule(ctx)).map((c) => ({ ...c, score: noveltyScore(c, day.date, pastMoments) }));
  const selected = selectMoments(candidates, options);

  const moments: Moment[] = [];
  for (const c of selected) {
    const info = MOMENT_CATALOG[c.type];
    moments.push({
      id: `${day.date}:${c.type}:${c.memberIds.join('-')}`,
      date: day.date,
      type: c.type,
      category: info.category,
      style: info.style,
      memberIds: c.memberIds,
      vars: c.vars,
      variant: chooseVariant(c, day.date, options.leagueSeed, [...pastMoments, ...moments]),
      stats: c.stats,
      provenance: c.provenance,
      score: Math.round(c.score),
      noveltyKey: c.noveltyKey,
      results: c.results,
    });
  }
  return { date: day.date, competition, results, moments };
}

/** Runs the engine over consecutive days, feeding each day's moments into the next day's novelty check. */
export function runDays(days: DayInput[], members: Member[], options: EngineOptions): DayOutput[] {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const outputs: DayOutput[] = [];
  const past: Moment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const history = new HistoryIndex(sorted.slice(0, i));
    const out = runDay(sorted[i], history, members, past, options);
    outputs.push(out);
    past.push(...out.moments);
  }
  return outputs;
}
