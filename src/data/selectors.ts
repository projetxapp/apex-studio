import type { Award, DailyDrop, Member, MemberId, Moment, ReactionEmoji, RecordEntry, Standing } from '@/domain/types';
import { REACTIONS } from '@/domain/types';
import type { LeagueSnapshot } from './snapshot';

/** Pure helpers deriving screen data from a snapshot. Work identically for demo and live. */

export function memberMap(s: LeagueSnapshot): Map<MemberId, Member> {
  return new Map(s.members.map((m) => [m.id, m]));
}

export function reactionSummary(s: LeagueSnapshot, momentId: string) {
  const list = s.reactions.filter((r) => r.momentId === momentId);
  const counts = REACTIONS.map((emoji) => ({ emoji, count: list.filter((r) => r.emoji === emoji).length }));
  const mine = list.find((r) => r.memberId === s.meId)?.emoji ?? null;
  return { counts, mine: mine as ReactionEmoji | null, total: list.length };
}

export interface PlayerProfile {
  member: Member;
  standing: Standing | undefined;
  awards: Award[];
  records: RecordEntry[];
  closest: { member: Member; minutes: number } | null;
  moments: Moment[];
  appearances: number;
  battleWins: number;
  titles: { month: string; label: string }[];
}

export function playerProfile(s: LeagueSnapshot, id: MemberId): PlayerProfile | null {
  const members = memberMap(s);
  const member = members.get(id);
  if (!member) return null;
  const allMoments = s.drops.flatMap((d) => d.moments);
  const mine = allMoments.filter((m) => m.memberIds.includes(id));

  const pairs = s.pairMinutes
    .filter((p) => p.a === id || p.b === id)
    .sort((x, y) => y.minutes - x.minutes);
  const top = pairs[0];
  const closestMember = top ? members.get(top.a === id ? top.b : top.a) : undefined;

  const titles = s.pastSeasons
    .filter((r) => r.championId === id)
    .map((r) => ({ month: r.season.month, label: 'CHAMPION' }));

  return {
    member,
    standing: s.standings.find((st) => st.memberId === id),
    awards: s.awards.filter((a) => a.memberIds.includes(id)),
    records: s.records.filter((r) => r.memberIds.includes(id)),
    closest: closestMember && top ? { member: closestMember, minutes: top.minutes } : null,
    moments: mine
      .filter((m) => m.type !== 'TODAYS_BATTLE' && m.type !== 'GROUP_STAT' && m.memberIds.length <= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8),
    appearances: mine.length,
    battleWins: allMoments.filter((m) => m.type === 'TODAYS_BATTLE' && m.memberIds[0] === id).length,
    titles,
  };
}

/** Drops grouped by month, newest first. */
export function dropsByMonth(drops: DailyDrop[]): { month: string; drops: DailyDrop[] }[] {
  const groups = new Map<string, DailyDrop[]>();
  for (const d of drops) {
    const month = d.date.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), d]);
  }
  return [...groups.entries()].map(([month, list]) => ({ month, drops: list }));
}

export function daysLeftInSeason(s: LeagueSnapshot): number {
  const end = Date.parse(s.season.endsOn);
  const today = Date.parse(s.today.date);
  return Math.max(0, Math.round((end - today) / 86_400_000));
}
