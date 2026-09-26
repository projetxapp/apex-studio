/**
 * Core domain model for THE LEAGUE.
 *
 * Everything the UI renders is expressed with these types, whether it comes from
 * the simulated demo League or from Supabase. Swapping the data source never
 * requires touching the screens.
 */

export type MemberId = string;
/** Calendar day in the League's timezone, formatted `YYYY-MM-DD`. */
export type ISODate = string;

/**
 * Where a number comes from. Shown to users so nobody mistakes a guess for a fact.
 * - `verified`  : server-side checked device data (e.g. HealthKit samples not entered by hand)
 * - `device`    : reported by a device API, not yet cross-checked
 * - `inferred`  : derived by a heuristic (e.g. "probably together" from coarse areas)
 * - `manual`    : typed by the user; never eligible for points
 * - `simulated` : fictional demo data
 */
export type Provenance = 'verified' | 'device' | 'inferred' | 'manual' | 'simulated';

export interface Member {
  id: MemberId;
  displayName: string;
  /** Short handle used on cards, e.g. "HIPPO". */
  tag: string;
  color: string;
  /** Data sources this member has opted into (demo: fictional opt-ins). */
  sources: DataSourceKind[];
}

export type DataSourceKind =
  | 'motion' // steps, distance (iPhone motion coprocessor / HealthKit)
  | 'sleep'
  | 'proximity' // time together — requires mutual consent
  | 'routine' // leaving / returning home (derived locally, never raw GPS)
  | 'music'
  | 'photos' // metadata counts only, never the photos
  | 'calendar' // event counts only
  | 'screen'
  | 'transport';

export interface League {
  id: string;
  name: string;
  inviteCode: string | null;
  timezone: string;
  isSimulated: boolean;
}

/**
 * Per-member daily signals. Every field is optional: a member who did not opt
 * into a source simply has no value, and rules must cope with missing data.
 * Times are minutes since local midnight (can exceed 1440 for after-midnight bedtimes).
 */
export interface DailyMetrics {
  memberId: MemberId;
  date: ISODate;
  provenance: Provenance;
  steps?: number;
  distanceKm?: number;
  activeMinutes?: number;
  sleepMinutes?: number;
  bedtime?: number;
  wakeTime?: number;
  leftHomeAt?: number;
  returnedHomeAt?: number;
  placesVisited?: number;
  screenMinutes?: number;
  musicMinutes?: number;
  topArtist?: string;
  photosTaken?: number;
  calendarEvents?: number;
  transitMinutes?: number;
  bikeMinutes?: number;
}

/** Time two members spent near each other. Only exists with mutual consent. */
export interface PairEncounter {
  date: ISODate;
  a: MemberId;
  b: MemberId;
  minutes: number;
  /** Minutes since midnight when the last shared moment ended. */
  endedAt: number;
  provenance: Provenance;
}

/** Several members in the same place for a meaningful period. */
export interface Gathering {
  date: ISODate;
  memberIds: MemberId[];
  minutes: number;
  provenance: Provenance;
}

/** Everything the Moment Engine knows about one day. */
export interface DayInput {
  date: ISODate;
  metrics: DailyMetrics[];
  encounters: PairEncounter[];
  gatherings: Gathering[];
}

export type CompetitionKind = 'steps' | 'distance' | 'beat_your_average' | 'together_time' | 'active_minutes';

export interface Competition {
  date: ISODate;
  kind: CompetitionKind;
}

export interface CompetitionResult {
  memberId: MemberId;
  value: number;
  rank: number;
  points: number;
  /** false when the value is not trustworthy enough for points (manual, missing, suspicious). */
  eligible: boolean;
  note?: 'manual' | 'suspicious' | 'missing';
}

export type MomentType =
  | 'BROMANCE'
  | 'MISSING'
  | 'THE_LINK_UP'
  | 'TROUBLE_IN_PARADISE'
  | 'WEIRDLY_IN_SYNC'
  | 'RECORD_BROKEN'
  | 'PERSONAL_RECORD'
  | 'TODAYS_BATTLE'
  | 'NIGHT_OWL'
  | 'EARLY_BIRD'
  | 'MUSIC_TWINS'
  | 'HOMEBODY'
  | 'EXPLORER'
  | 'PHOTO_DUMP'
  | 'CALENDAR_CHAOS'
  | 'SAME_MINUTE'
  | 'GROUP_STAT'
  | 'SLEEP_CHAMP'
  | 'STREAK';

export type MomentCategory = 'social' | 'fact' | 'competitive';

/** Visual family of a Daily Drop card. */
export type CardStyle = 'duo' | 'alert' | 'crowd' | 'record' | 'battle' | 'sync' | 'night' | 'stat' | 'vibe';

/** How a raw value must be formatted by the renderer (locale-aware). */
export type ValueFormat = 'int' | 'duration' | 'clock' | 'km' | 'percent' | 'hours' | 'text' | 'unit' | 'competition';

export interface MomentValue {
  v: number | string;
  f: ValueFormat;
}

/** A stat displayed large on a card. The label is an i18n key under `stats`. */
export interface MomentStat {
  key: string;
  value: MomentValue;
}

/**
 * A Daily Drop card, stored as structured data (never as final text) so it can be
 * persisted in Supabase, re-rendered in another language and audited.
 * Rendering to sentences happens in `engine/render.ts`.
 */
export interface Moment {
  id: string;
  date: ISODate;
  type: MomentType;
  category: MomentCategory;
  style: CardStyle;
  /** Members featured on the card; `{a}`, `{b}`, `{c}` in captions refer to them in order. */
  memberIds: MemberId[];
  vars: Record<string, MomentValue>;
  /** Selects which headline / quip variant to use. */
  variant: number;
  stats: MomentStat[];
  provenance: Provenance;
  /** Interest score after novelty adjustment, 0–100. */
  score: number;
  /** Stable key used to detect repetition (e.g. `BROMANCE:hippolyte|joseph`). */
  noveltyKey: string;
  /** Points awarded by this moment (only TODAYS_BATTLE). */
  results?: CompetitionResult[];
}

export type ReactionEmoji = '😂' | '🔥' | '💀' | '👀' | '🫶';
export const REACTIONS: ReactionEmoji[] = ['😂', '🔥', '💀', '👀', '🫶'];

export interface Reaction {
  momentId: string;
  memberId: MemberId;
  emoji: ReactionEmoji;
}

export interface DailyDrop {
  date: ISODate;
  competition: Competition;
  moments: Moment[];
  /** true once the evening reveal happened. */
  revealed: boolean;
}

export interface Standing {
  memberId: MemberId;
  points: number;
  rank: number;
  wins: number;
  /** Rank change since the previous day (+ = climbed). */
  delta: number;
}

export type RecordKey = 'steps_day' | 'distance_day' | 'duo_day' | 'gathering' | 'latest_bedtime' | 'personal_steps';

export interface RecordEntry {
  id: string;
  scope: 'group' | 'personal';
  /** i18n key under `records`. */
  key: RecordKey;
  memberIds: MemberId[];
  value: MomentValue;
  date: ISODate;
}

export interface Season {
  id: string;
  /** `YYYY-MM` */
  month: string;
  startsOn: ISODate;
  endsOn: ISODate;
  status: 'active' | 'closed';
}

export type AwardKey =
  | 'champion'
  | 'steps_king'
  | 'iconic_duo'
  | 'ghost'
  | 'night_owl'
  | 'photographer'
  | 'social_butterfly'
  | 'homebody'
  | 'minister';

export interface Award {
  id: string;
  /** i18n key under `awards`. */
  key: AwardKey;
  memberIds: MemberId[];
  value?: MomentValue;
  competitive: boolean;
}

export interface SeasonRecap {
  season: Season;
  standings: Standing[];
  championId: MemberId | null;
  awards: Award[];
  records: RecordEntry[];
  iconicDuo: { a: MemberId; b: MemberId; minutes: number } | null;
  unexpected: Moment[];
  totals: { moments: number; steps: number; minutesTogether: number };
}
