-- Move internal helper functions out of the API-exposed `public` schema.
-- Policies reference functions by OID, so they keep working unchanged, but the helpers
-- are no longer callable as /rest/v1/rpc/* endpoints.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_league_member(uuid) set schema private;
alter function public.shares_league_with(uuid) set schema private;
alter function public.is_league_owner(uuid) set schema private;
alter function public.generate_invite_code() set schema private;
alter function public.handle_new_user() set schema private;

-- Functions that call the helpers by name must point to their new schema.
create or replace function public.ensure_current_season(p_league uuid)
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
  if not private.is_league_member(p_league) then
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

create or replace function public.create_league(p_name text)
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
      values (trim(p_name), private.generate_invite_code(), uid)
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

create or replace function public.rotate_invite_code(p_league uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not private.is_league_owner(p_league) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  code := private.generate_invite_code();
  update public.leagues set invite_code = code where id = p_league;
  return code;
end;
$$;

