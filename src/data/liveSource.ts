import type { SupabaseClient } from '@supabase/supabase-js';

import { competitionFor } from '@/engine/competition';
import { seasonFor } from '@/engine/season';
import { endOfMonth, localToday, startOfMonth } from '@/lib/dates';
import type { Database } from '@/lib/database.types';
import type {
  Award,
  AwardKey,
  CompetitionResult,
  DailyDrop,
  Member,
  Moment,
  MomentCategory,
  MomentType,
  Reaction,
  ReactionEmoji,
  Standing,
} from '@/domain/types';
import { MOMENT_CATALOG } from '@/engine/catalog';
import { DROP_REVEAL_MINUTE, type LeagueSnapshot } from './snapshot';

type Client = SupabaseClient<Database>;

/**
 * Reads a real League from Supabase and shapes it like the demo snapshot.
 * RLS guarantees we only ever receive rows from Leagues the user belongs to.
 * Moments, points and awards are produced server-side (future phase); until then
 * a new League simply shows empty states.
 */

export interface LeagueSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

export async function listMyLeagues(client: Client, userId: string): Promise<LeagueSummary[]> {
  const { data, error } = await client
    .from('league_members')
    .select('role, leagues(id, name)')
    .eq('user_id', userId)
    .order('joined_at');
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const league = row.leagues as unknown as { id: string; name: string } | null;
    return league ? [{ id: league.id, name: league.name, role: row.role }] : [];
  });
}

interface MomentPayload {
  vars?: Moment['vars'];
  stats?: Moment['stats'];
  variant?: number;
  results?: CompetitionResult[];
  noveltyKey?: string;
}

function toMoment(row: Database['public']['Tables']['daily_moments']['Row']): Moment | null {
  const type = row.type as MomentType;
  const info = MOMENT_CATALOG[type];
  if (!info) return null; // Unknown type from a newer server: skip rather than crash.
  const payload = (row.payload ?? {}) as MomentPayload;
  return {
    id: row.id,
    date: row.day,
    type,
    category: row.category as MomentCategory,
    style: info.style,
    memberIds: row.member_ids,
    vars: payload.vars ?? {},
    variant: payload.variant ?? 0,
    stats: payload.stats ?? [],
    provenance: row.provenance,
    score: row.score,
    noveltyKey: payload.noveltyKey ?? `${type}:${row.member_ids.join('|')}`,
    results: payload.results,
  };
}

export async function loadLiveSnapshot(client: Client, userId: string, leagueId: string): Promise<LeagueSnapshot> {
  const today = localToday();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  await client.rpc('ensure_current_season', { p_league: leagueId });

  const [league, members, seasonRow, moments] = await Promise.all([
    client.from('leagues').select('*').eq('id', leagueId).single(),
    client.from('league_members').select('user_id, role, profiles(display_name, color)').eq('league_id', leagueId),
    client.from('seasons').select('*').eq('league_id', leagueId).eq('starts_on', startOfMonth(today)).maybeSingle(),
    client.from('daily_moments').select('*').eq('league_id', leagueId).order('day', { ascending: false }).limit(300),
  ]);
  for (const r of [league, members, seasonRow, moments]) if (r.error) throw r.error;

  const seasonId = seasonRow.data?.id;
  const [standingsRes, awardsRes, competitionRes] = await Promise.all([
    seasonId
      ? client.from('season_standings').select('*').eq('season_id', seasonId)
      : Promise.resolve({ data: [], error: null }),
    seasonId ? client.from('awards').select('*').eq('season_id', seasonId) : Promise.resolve({ data: [], error: null }),
    client.from('competitions').select('*').eq('league_id', leagueId).eq('day', today).maybeSingle(),
  ]);

  const memberList: Member[] = (members.data ?? []).map((row) => {
    const profile = row.profiles as unknown as { display_name: string; color: string } | null;
    const name = profile?.display_name ?? 'Membre';
    return {
      id: row.user_id,
      displayName: name,
      tag: name.slice(0, 6).toUpperCase(),
      color: profile?.color ?? '#FF5A36',
      sources: [], // Other members' opt-ins are private.
    };
  });

  const allMoments = (moments.data ?? []).map(toMoment).filter((m): m is Moment => m !== null);
  const momentIds = allMoments.map((m) => m.id);
  const reactionsRes = momentIds.length
    ? await client.from('moment_reactions').select('moment_id, user_id, emoji').in('moment_id', momentIds.slice(0, 200))
    : { data: [], error: null };

  const byDate = new Map<string, Moment[]>();
  for (const m of allMoments) {
    if (m.date === today && nowMinutes < DROP_REVEAL_MINUTE) continue; // tonight's Drop stays hidden
    byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
  }
  const drops: DailyDrop[] = [...byDate.entries()].map(([date, list]) => ({
    date,
    competition: competitionFor(date, leagueId),
    moments: list.sort((a, b) => (a.type === 'TODAYS_BATTLE' ? 1 : b.type === 'TODAYS_BATTLE' ? -1 : b.score - a.score)),
    revealed: true,
  }));

  const rawStandings = (standingsRes.data ?? []) as { user_id: string | null; points: number | null; wins: number | null }[];
  const standings: Standing[] = memberList
    .map((m) => {
      const row = rawStandings.find((s) => s.user_id === m.id);
      return { memberId: m.id, points: row?.points ?? 0, wins: row?.wins ?? 0, rank: 0, delta: 0 };
    })
    .sort((a, b) => b.points - a.points)
    .map((s, i, arr) => ({ ...s, rank: i > 0 && arr[i - 1].points === s.points ? i : i + 1 }));

  const awards: Award[] = ((awardsRes.data ?? []) as Database['public']['Tables']['awards']['Row'][]).map((a) => ({
    id: a.id,
    key: a.key as AwardKey,
    memberIds: a.member_ids,
    value: (a.value as unknown as Award['value']) ?? undefined,
    competitive: a.competitive,
  }));

  const pending = allMoments.filter((m) => m.date === today).length;
  const competition = competitionRes.data
    ? { date: today, kind: competitionRes.data.kind }
    : competitionFor(today, leagueId);

  return {
    mode: 'live',
    league: {
      id: league.data!.id,
      name: league.data!.name,
      inviteCode: league.data!.invite_code,
      timezone: league.data!.timezone,
      isSimulated: false,
    },
    meId: userId,
    members: memberList,
    today: {
      date: today,
      competition,
      participants: memberList.length,
      revealAt: DROP_REVEAL_MINUTE,
      revealed: nowMinutes >= DROP_REVEAL_MINUTE,
      pendingMoments: nowMinutes >= DROP_REVEAL_MINUTE ? 0 : pending,
    },
    drops,
    season: seasonRow.data
      ? { ...seasonFor(today, today), id: seasonRow.data.id, startsOn: seasonRow.data.starts_on, endsOn: seasonRow.data.ends_on }
      : { ...seasonFor(today, today), endsOn: endOfMonth(today) },
    standings,
    records: [],
    awards,
    pastSeasons: [],
    pairMinutes: [],
    reactions: ((reactionsRes.data ?? []) as { moment_id: string; user_id: string; emoji: string }[]).map((r) => ({
      momentId: r.moment_id,
      memberId: r.user_id,
      emoji: r.emoji as ReactionEmoji,
    })) satisfies Reaction[],
  };
}

export async function setLiveReaction(client: Client, userId: string, momentId: string, emoji: ReactionEmoji | null) {
  if (emoji === null) {
    const { error } = await client.from('moment_reactions').delete().eq('moment_id', momentId).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  // Only `emoji` is updatable (column grant), so no upsert: update first, insert if nothing changed.
  const updated = await client
    .from('moment_reactions')
    .update({ emoji })
    .eq('moment_id', momentId)
    .eq('user_id', userId)
    .select('moment_id');
  if (updated.error) throw updated.error;
  if (updated.data.length > 0) return;
  const { error } = await client.from('moment_reactions').insert({ moment_id: momentId, user_id: userId, emoji });
  if (error) throw error;
}
