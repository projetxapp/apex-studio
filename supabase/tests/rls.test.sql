-- Row Level Security tests. Run with: npm run db:test (needs a local Postgres, see run-local.sh)
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

create schema test;
grant usage on schema test to anon, authenticated, service_role;

create function test.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- true if the statement raises an error
create function test.throws(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;
grant execute on all functions in schema test to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{"display_name":"Carol"}');

select test.check((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice', 'profile created from sign-up metadata');
select test.check((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'bob', 'profile falls back to e-mail prefix');
select test.check((select count(*) from public.privacy_settings) = 3, 'privacy settings created, everything off by default');

-- ——— Alice creates a League, Bob joins, Carol has her own ———
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
create temp table ctx as select * from public.create_league('Les Potes');
select test.check((select invite_code ~ '^[A-HJ-NP-Z2-9]{8}$' from ctx), 'invite code format');
select test.check((select count(*) from public.seasons) = 1, 'current season created');
reset role;
grant select on ctx to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select test.check(test.throws('select public.join_league(''ZZZZZZZZ'')'), 'invalid invite code rejected');
select test.check(public.join_league(lower((select invite_code from ctx))) = (select id from ctx), 'bob joins with a lower-case code');
select test.check((select count(*) from public.league_members) = 2, 'bob sees both members of his League');
select test.check((select count(*) from public.profiles) = 2, 'bob sees alice''s profile');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select test.check((select name from public.create_league('Autre League')) = 'Autre League', 'carol creates her own League');
select test.check((select count(*) from public.leagues) = 1, 'carol only sees her own League');
select test.check((select count(*) from public.league_members where league_id = (select id from ctx)) = 0, 'carol cannot list another League''s members');
select test.check((select count(*) from public.profiles) = 1, 'carol cannot see alice or bob');
select test.check((select count(*) from public.seasons where league_id = (select id from ctx)) = 0, 'carol cannot see another League''s seasons');
select test.check(test.throws('select public.ensure_current_season((select id from ctx))'), 'carol cannot create seasons in another League');
reset role;

-- ——— Server writes a moment (runs as the table owner, like the service role) ———
insert into public.daily_moments (league_id, day, type, category, member_ids, payload, score, provenance)
select id, current_date, 'BROMANCE', 'social',
  array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']::uuid[],
  '{"vars":{"minutes":{"v":374,"f":"duration"}},"variant":0}', 80, 'inferred'
from ctx;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select test.check((select count(*) from public.daily_moments) = 1, 'bob reads his League''s moments');
insert into public.moment_reactions (moment_id, emoji) select id, '🔥' from public.daily_moments;
update public.moment_reactions set emoji = '😂';
select test.check((select emoji from public.moment_reactions) = '😂', 'bob changes his reaction');
select test.check(test.throws('insert into public.moment_reactions (moment_id, emoji) select id, ''🍆'' from public.daily_moments'), 'unknown emoji rejected');
select test.check(test.throws('insert into public.daily_moments (league_id, day, type, category, provenance) select id, current_date, ''FAKE'', ''social'', ''verified'' from ctx'), 'members cannot forge moments');
update public.leagues set name = 'Hacked';
select test.check((select name from public.leagues where id = (select id from ctx)) = 'Les Potes', 'league name unchanged by non-owner');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select test.check((select count(*) from public.daily_moments) = 0, 'carol cannot read another League''s moments');
select test.check((select count(*) from public.moment_reactions) = 0, 'carol cannot read another League''s reactions');
select test.check(test.throws('insert into public.moment_reactions (moment_id, emoji) values ((select id from public.daily_moments limit 1), ''🔥'')'), 'carol cannot react outside her League');
reset role;
select test.check(
  (select count(*) from public.moment_reactions r where r.user_id = '00000000-0000-0000-0000-00000000000c') = 0,
  'no reaction stored for carol');

-- ——— Metrics are private and cannot be self-verified ———
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select test.check(test.throws('insert into public.daily_metrics (day, metric, value, source, provenance) values (current_date, ''steps'', 99999, ''motion'', ''verified'')'), 'client cannot claim verified data');
insert into public.daily_metrics (day, metric, value, source, provenance) values (current_date, 'steps', 8421, 'motion', 'device');
select test.check(test.throws('insert into public.daily_metrics (user_id, day, metric, value, source, provenance) values (''00000000-0000-0000-0000-00000000000b'', current_date, ''steps'', 1, ''motion'', ''device'')'), 'cannot write metrics for someone else');
select test.check(test.throws('update public.leagues set invite_code = ''AAAAAAAA'''), 'owner cannot hand-pick an invite code');
update public.leagues set name = 'Les Vrais Potes' where id = (select id from ctx);
select test.check((select name from public.leagues where id = (select id from ctx)) = 'Les Vrais Potes', 'owner renames League');
select test.check((select public.rotate_invite_code((select id from ctx))) <> (select invite_code from ctx), 'owner rotates invite code');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select test.check((select count(*) from public.daily_metrics) = 0, 'bob cannot read alice''s raw metrics');
select test.check(test.throws('select public.rotate_invite_code((select id from ctx))'), 'non-owner cannot rotate invite code');
select test.check((select count(*) from public.privacy_settings) = 1, 'bob only sees his own privacy settings');
reset role;

select test.check(test.throws('select public.is_league_member(gen_random_uuid())'), 'helper functions are not exposed in the public API schema');
reset role;

-- ——— Anonymous visitors get nothing ———
set role anon;
select test.check(test.throws('select * from public.profiles'), 'anon cannot read profiles');
select test.check(test.throws('select * from public.leagues'), 'anon cannot read leagues');
select test.check(test.throws('select public.join_league(''ABCDEFGH'')'), 'anon cannot join');
reset role;

-- ——— Leaving and deleting ———
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.leave_league((select id from ctx));
reset role;
select test.check((select user_id from public.league_members where league_id = (select id from ctx) and role = 'owner') = '00000000-0000-0000-0000-00000000000b', 'ownership passes to the next member');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select public.delete_my_account();
reset role;
select test.check(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000c'), 'account deleted');
select test.check(not exists (select 1 from public.leagues where name = 'Autre League'), 'empty League removed');
select test.check(not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'profile deleted');

\echo 'All RLS tests passed.'
