import type {
  Award,
  Competition,
  DailyDrop,
  ISODate,
  League,
  Member,
  MemberId,
  Reaction,
  RecordEntry,
  Season,
  SeasonRecap,
  Standing,
} from '@/domain/types';

/**
 * Everything the screens need, in one immutable object.
 * Both the demo source and the Supabase source produce this exact shape, so the UI
 * never knows (or cares) where the data came from — apart from showing the DEMO badge.
 */
export interface LeagueSnapshot {
  mode: 'demo' | 'live';
  league: League;
  meId: MemberId | null;
  members: Member[];
  today: {
    date: ISODate;
    competition: Competition;
    /** Members who can take part in today's competition. */
    participants: number;
    /** Minutes since midnight when the Drop is revealed. */
    revealAt: number;
    revealed: boolean;
    /** How many moments are waiting (shown as a teaser, content hidden). */
    pendingMoments: number;
  };
  /** Revealed Drops, newest first. */
  drops: DailyDrop[];
  season: Season;
  standings: Standing[];
  records: RecordEntry[];
  awards: Award[];
  pastSeasons: SeasonRecap[];
  /** Minutes together per pair this season (for "closest teammate"). */
  pairMinutes: { a: MemberId; b: MemberId; minutes: number }[];
  reactions: Reaction[];
}

export const DROP_REVEAL_MINUTE = 21 * 60;
