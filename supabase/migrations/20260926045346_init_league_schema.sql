-- THE LEAGUE — initial schema
--
-- Principles
-- * RLS on every table. A member can only ever read data of Leagues they belong to.
-- * Raw daily metrics are private to their owner. Other members only see derived results
--   (moments, points, awards), which are written by the server (service role), never by clients.
-- * Clients can never claim a metric is "verified"; only the server can.
-- * Demo data lives in the app bundle and is never written here. `provenance = 'simulated'`
--   exists only for explicit test data and is always labelled in the UI.

-- ——— Types ————————————————————————————————————————————————————————————

create type public.provenance as enum ('verified', 'device', 'inferred', 'manual', 'simulated');
create type public.member_role as enum ('owner', 'member');
create type public.data_source as enum (
  'motion', 'sleep', 'proximity', 'routine', 'music', 'photos', 'calendar', 'screen', 'transport'
);
create type public.competition_kind as enum (
  'steps', 'distance', 'beat_your_average', 'together_time', 'active_minutes'
);

-- ——— Tables ———————————————————————————————————————————————————————————

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null default '#FF5A36' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Public profile, visible to members of shared Leagues only.';

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  -- 8 chars from an unambiguous alphabet (no 0/O/1/I): ~10^12 combinations.
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  timezone text not null default 'Europe/Paris',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index league_members_user_idx on public.league_members (user_id);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  unique (league_id, starts_on),
  check (ends_on >= starts_on)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  day date not null,
  kind public.competition_kind not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'finalized')),
  unique (league_id, day)
);
create index competitions_season_idx on public.competitions (season_id);

-- One row per user × day × metric × source. Private to the owner.
create table public.daily_metrics (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  metric text not null check (metric ~ '^[a-z_]{2,40}$'),
  value numeric not null,
  source public.data_source not null,
  provenance public.provenance not null,
  recorded_at timestamptz not null default now(),
  unique (user_id, day, metric, source)
);

-- Daily Drop cards. Stored as structured data (type + payload), rendered by the app.
create table public.daily_moments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  day date not null,
  type text not null check (type ~ '^[A-Z_]{3,40}$'),
  category text not null check (category in ('social', 'fact', 'competitive')),
  member_ids uuid[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  score smallint not null default 0 check (score between 0 and 100),
  provenance public.provenance not null,
  created_at timestamptz not null default now()
);
create index daily_moments_league_day_idx on public.daily_moments (league_id, day desc);

create table public.moment_reactions (
  moment_id uuid not null references public.daily_moments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('😂', '🔥', '💀', '👀', '🫶')),
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);
create index moment_reactions_user_idx on public.moment_reactions (user_id);

-- Season points, one row per competition × member. Written by the server only.
create table public.season_points (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value numeric,
  rank smallint not null default 0,
  points smallint not null default 0 check (points between 0 and 100),
  eligible boolean not null default true,
  note text check (note in ('manual', 'suspicious', 'missing')),
  unique (competition_id, user_id)
);
create index season_points_season_idx on public.season_points (season_id);
create index season_points_user_idx on public.season_points (user_id);

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  key text not null,
  member_ids uuid[] not null default '{}',
  value jsonb,
  competitive boolean not null default false,
  created_at timestamptz not null default now()
);
create index awards_season_idx on public.awards (season_id);

-- Per-user privacy choices. Never visible to other members.
create table public.privacy_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled_sources public.data_source[] not null default '{}',
  tracking_paused boolean not null default false,
  hide_sensitive boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ——— Helper functions (security definer to avoid RLS recursion) ————————————

create function public.is_league_member(p_league uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = (select auth.uid())
  );
$$;

create function public.shares_league_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members mine
    join public.league_members theirs on theirs.league_id = mine.league_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

create function public.is_league_owner(p_league uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- ——— Row Level Security ———————————————————————————————————————————————

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.seasons enable row level security;
alter table public.competitions enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.daily_moments enable row level security;
alter table public.moment_reactions enable row level security;
alter table public.season_points enable row level security;
alter table public.awards enable row level security;
alter table public.privacy_settings enable row level security;

-- profiles
create policy "profiles: read self and league mates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_league_with(id));
create policy "profiles: insert self" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- leagues (creation / joining go through RPCs below)
create policy "leagues: members read" on public.leagues
  for select to authenticated
  using (public.is_league_member(id));
create policy "leagues: owner renames" on public.leagues
  for update to authenticated
  using (public.is_league_owner(id))
  with check (public.is_league_owner(id));

-- league_members
create policy "league_members: members read" on public.league_members
  for select to authenticated
  using (public.is_league_member(league_id));

-- seasons / competitions / moments / points / awards: read-only for members
create policy "seasons: members read" on public.seasons
  for select to authenticated using (public.is_league_member(league_id));
create policy "competitions: members read" on public.competitions
  for select to authenticated using (public.is_league_member(league_id));
create policy "daily_moments: members read" on public.daily_moments
  for select to authenticated using (public.is_league_member(league_id));
create policy "season_points: members read" on public.season_points
  for select to authenticated using (public.is_league_member(league_id));
create policy "awards: members read" on public.awards
  for select to authenticated using (public.is_league_member(league_id));

-- daily_metrics: strictly private; clients cannot self-certify "verified".
create policy "daily_metrics: owner reads" on public.daily_metrics
  for select to authenticated using (user_id = (select auth.uid()));
create policy "daily_metrics: owner inserts" on public.daily_metrics
  for insert to authenticated
  with check (user_id = (select auth.uid()) and provenance <> 'verified');
create policy "daily_metrics: owner updates" on public.daily_metrics
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and provenance <> 'verified');
create policy "daily_metrics: owner deletes" on public.daily_metrics
  for delete to authenticated using (user_id = (select auth.uid()));

-- moment_reactions
create policy "moment_reactions: members read" on public.moment_reactions
  for select to authenticated
  using (exists (
    select 1 from public.daily_moments m
    where m.id = moment_id and public.is_league_member(m.league_id)
  ));
create policy "moment_reactions: react as self" on public.moment_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.daily_moments m
      where m.id = moment_id and public.is_league_member(m.league_id)
    )
  );
create policy "moment_reactions: change own" on public.moment_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "moment_reactions: remove own" on public.moment_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- privacy_settings
create policy "privacy_settings: owner reads" on public.privacy_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "privacy_settings: owner inserts" on public.privacy_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "privacy_settings: owner updates" on public.privacy_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Defense in depth: signed-out visitors get nothing at all.
revoke all on
  public.profiles, public.leagues, public.league_members, public.seasons, public.competitions,
  public.daily_metrics, public.daily_moments, public.moment_reactions, public.season_points,
  public.awards, public.privacy_settings
from anon;

-- Server-owned tables: authenticated users may only read them.
revoke insert, update, delete on
  public.league_members, public.seasons, public.competitions,
  public.daily_moments, public.season_points, public.awards
from authenticated;
revoke insert, update, delete on public.leagues from authenticated;
grant update (name, timezone) on public.leagues to authenticated;
-- Reactions: only the emoji can change (moving a reaction to another League's moment is impossible).
revoke update on public.moment_reactions from authenticated;
grant update (emoji) on public.moment_reactions to authenticated;
-- Profiles: only presentation fields can change.
revoke update on public.profiles from authenticated;
grant update (display_name, color) on public.profiles to authenticated;

-- ——— Standings view (respects the caller's RLS) ————————————————————————

create view public.season_standings
with (security_invoker = true) as
select
  sp.league_id,
  sp.season_id,
  sp.user_id,
  sum(sp.points)::int as points,
  (count(*) filter (where sp.rank = 1))::int as wins
from public.season_points sp
group by sp.league_id, sp.season_id, sp.user_id;

revoke all on public.season_standings from anon;

-- ——— New user bootstrap —————————————————————————————————————————————

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Joueur'), 40)
  )
  on conflict (id) do nothing;
  insert into public.privacy_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ——— RPCs ——————————————————————————————————————————————————————————

create function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  bytes bytea := extensions.gen_random_bytes(8);
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- Creates the season of the current month (League timezone) if missing. Members only.
create function public.ensure_current_season(p_league uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  today date;
  season_id uuid;
begin
  if not public.is_league_member(p_league) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select timezone into tz from public.leagues where id = p_league;
  today := (now() at time zone tz)::date;
  insert into public.seasons (league_id, starts_on, ends_on)
  values (p_league, date_trunc('month', today)::date, (date_trunc('month', today) + interval '1 month - 1 day')::date)
  on conflict (league_id, starts_on) do nothing;
  select id into season_id from public.seasons
  where league_id = p_league and starts_on = date_trunc('month', today)::date;
  return season_id;
end;
$$;

create function public.create_league(p_name text)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  created public.leagues;
  attempts int := 0;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.league_members where user_id = uid and role = 'owner') >= 5 then
    raise exception 'too_many_leagues';
  end if;
  loop
    begin
      insert into public.leagues (name, invite_code, created_by)
      values (trim(p_name), public.generate_invite_code(), uid)
      returning * into created;
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 5 then raise; end if;
    end;
  end loop;
  insert into public.league_members (league_id, user_id, role) values (created.id, uid, 'owner');
  perform public.ensure_current_season(created.id);
  return created;
end;
$$;

create function public.join_league(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select id into target from public.leagues where invite_code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if target is null then
    raise exception 'invalid_code';
  end if;
  if not exists (select 1 from public.league_members where league_id = target and user_id = uid)
     and (select count(*) from public.league_members where league_id = target) >= 20 then
    raise exception 'league_full';
  end if;
  insert into public.league_members (league_id, user_id) values (target, uid)
  on conflict (league_id, user_id) do nothing;
  perform public.ensure_current_season(target);
  return target;
end;
$$;

create function public.leave_league(p_league uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  was_owner boolean;
  successor uuid;
begin
  select role = 'owner' into was_owner from public.league_members where league_id = p_league and user_id = uid;
  if was_owner is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  delete from public.league_members where league_id = p_league and user_id = uid;
  select user_id into successor from public.league_members where league_id = p_league order by joined_at limit 1;
  if successor is null then
    delete from public.leagues where id = p_league;
  elsif was_owner then
    update public.league_members set role = 'owner' where league_id = p_league and user_id = successor;
  end if;
end;
$$;

create function public.rotate_invite_code(p_league uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_league_owner(p_league) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  code := public.generate_invite_code();
  update public.leagues set invite_code = code where id = p_league;
  return code;
end;
$$;

-- Deletes the caller's account and every row that belongs to them (cascades),
-- then removes Leagues left without members.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  league uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  for league in select league_id from public.league_members where user_id = uid loop
    perform public.leave_league(league);
  end loop;
  delete from auth.users where id = uid;
end;
$$;

-- Function privileges: nothing for anonymous visitors.
revoke execute on function
  public.is_league_member(uuid), public.shares_league_with(uuid), public.is_league_owner(uuid),
  public.generate_invite_code(), public.ensure_current_season(uuid), public.create_league(text),
  public.join_league(text), public.leave_league(uuid), public.rotate_invite_code(uuid),
  public.delete_my_account(), public.handle_new_user()
from public, anon;
grant execute on function
  public.is_league_member(uuid), public.shares_league_with(uuid), public.is_league_owner(uuid),
  public.ensure_current_season(uuid), public.create_league(text), public.join_league(text),
  public.leave_league(uuid), public.rotate_invite_code(uuid), public.delete_my_account()
to authenticated;
revoke execute on function public.generate_invite_code(), public.handle_new_user() from authenticated;
