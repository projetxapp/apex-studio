// Generated from the Supabase schema (supabase gen types typescript), trimmed to the Database type.
// Regenerate after each migration: `npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}[];

type Provenance = 'verified' | 'device' | 'inferred' | 'manual' | 'simulated';
type DataSource = 'motion' | 'sleep' | 'proximity' | 'routine' | 'music' | 'photos' | 'calendar' | 'screen' | 'transport';
type CompetitionKind = 'steps' | 'distance' | 'beat_your_average' | 'together_time' | 'active_minutes';

type LeagueRow = {
  created_at: string;
  created_by: string | null;
  id: string;
  invite_code: string;
  name: string;
  timezone: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      awards: {
        Row: { competitive: boolean; created_at: string; id: string; key: string; league_id: string; member_ids: string[]; season_id: string; value: Json | null };
        Insert: { competitive?: boolean; created_at?: string; id?: string; key: string; league_id: string; member_ids?: string[]; season_id: string; value?: Json | null };
        Update: { competitive?: boolean; created_at?: string; id?: string; key?: string; league_id?: string; member_ids?: string[]; season_id?: string; value?: Json | null };
        Relationships: Rel;
      };
      competitions: {
        Row: { day: string; id: string; kind: CompetitionKind; league_id: string; season_id: string; status: string };
        Insert: { day: string; id?: string; kind: CompetitionKind; league_id: string; season_id: string; status?: string };
        Update: { day?: string; id?: string; kind?: CompetitionKind; league_id?: string; season_id?: string; status?: string };
        Relationships: Rel;
      };
      daily_metrics: {
        Row: { day: string; id: number; metric: string; provenance: Provenance; recorded_at: string; source: DataSource; user_id: string; value: number };
        Insert: { day: string; id?: never; metric: string; provenance: Provenance; recorded_at?: string; source: DataSource; user_id?: string; value: number };
        Update: { day?: string; id?: never; metric?: string; provenance?: Provenance; recorded_at?: string; source?: DataSource; user_id?: string; value?: number };
        Relationships: Rel;
      };
      daily_moments: {
        Row: { category: string; created_at: string; day: string; id: string; league_id: string; member_ids: string[]; payload: Json; provenance: Provenance; score: number; type: string };
        Insert: { category: string; created_at?: string; day: string; id?: string; league_id: string; member_ids?: string[]; payload?: Json; provenance: Provenance; score?: number; type: string };
        Update: { category?: string; created_at?: string; day?: string; id?: string; league_id?: string; member_ids?: string[]; payload?: Json; provenance?: Provenance; score?: number; type?: string };
        Relationships: Rel;
      };
      league_members: {
        Row: { joined_at: string; league_id: string; role: 'owner' | 'member'; user_id: string };
        Insert: { joined_at?: string; league_id: string; role?: 'owner' | 'member'; user_id: string };
        Update: { joined_at?: string; league_id?: string; role?: 'owner' | 'member'; user_id?: string };
        Relationships: Rel;
      };
      leagues: {
        Row: LeagueRow;
        Insert: Partial<LeagueRow> & { invite_code: string; name: string };
        Update: Partial<LeagueRow>;
        Relationships: Rel;
      };
      moment_reactions: {
        Row: { created_at: string; emoji: string; moment_id: string; user_id: string };
        Insert: { created_at?: string; emoji: string; moment_id: string; user_id?: string };
        Update: { created_at?: string; emoji?: string; moment_id?: string; user_id?: string };
        Relationships: Rel;
      };
      privacy_settings: {
        Row: { enabled_sources: DataSource[]; hide_sensitive: boolean; tracking_paused: boolean; updated_at: string; user_id: string };
        Insert: { enabled_sources?: DataSource[]; hide_sensitive?: boolean; tracking_paused?: boolean; updated_at?: string; user_id?: string };
        Update: { enabled_sources?: DataSource[]; hide_sensitive?: boolean; tracking_paused?: boolean; updated_at?: string; user_id?: string };
        Relationships: Rel;
      };
      profiles: {
        Row: { color: string; created_at: string; display_name: string; id: string };
        Insert: { color?: string; created_at?: string; display_name: string; id: string };
        Update: { color?: string; created_at?: string; display_name?: string; id?: string };
        Relationships: Rel;
      };
      season_points: {
        Row: { competition_id: string; eligible: boolean; id: number; league_id: string; note: string | null; points: number; rank: number; season_id: string; user_id: string; value: number | null };
        Insert: { competition_id: string; eligible?: boolean; id?: never; league_id: string; note?: string | null; points?: number; rank?: number; season_id: string; user_id: string; value?: number | null };
        Update: { competition_id?: string; eligible?: boolean; id?: never; league_id?: string; note?: string | null; points?: number; rank?: number; season_id?: string; user_id?: string; value?: number | null };
        Relationships: Rel;
      };
      seasons: {
        Row: { ends_on: string; id: string; league_id: string; starts_on: string; status: string };
        Insert: { ends_on: string; id?: string; league_id: string; starts_on: string; status?: string };
        Update: { ends_on?: string; id?: string; league_id?: string; starts_on?: string; status?: string };
        Relationships: Rel;
      };
    };
    Views: {
      season_standings: {
        Row: { league_id: string | null; points: number | null; season_id: string | null; user_id: string | null; wins: number | null };
        Relationships: Rel;
      };
    };
    Functions: {
      create_league: {
        Args: { p_name: string };
        Returns: LeagueRow;
        SetofOptions: { from: '*'; to: 'leagues'; isOneToOne: true; isSetofReturn: false };
      };
      delete_my_account: { Args: never; Returns: undefined };
      ensure_current_season: { Args: { p_league: string }; Returns: string };
      join_league: { Args: { p_code: string }; Returns: string };
      leave_league: { Args: { p_league: string }; Returns: undefined };
      rotate_invite_code: { Args: { p_league: string }; Returns: string };
    };
    Enums: {
      competition_kind: CompetitionKind;
      data_source: DataSource;
      member_role: 'owner' | 'member';
      provenance: Provenance;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
