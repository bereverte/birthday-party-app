-- Challenge rules: one call awards several players; re-awarding overwrites.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('11111111-1111-4111-8111-111111111111', 'Host', '👑'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Biel', '🐶'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Carla', '🦊');
insert into public.hosts (user_id) values ('11111111-1111-4111-8111-111111111111');

set local role authenticated;

-- A guest cannot award points -------------------------------------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.award_challenge_points(
       '00000000-0000-4000-c000-000000000001',
       array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[], 100) $$,
  'P0001', 'Only the host can do this',
  'guest cannot award challenge points'
);

-- Host awards a team (the host plays challenges too) ----------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is(
  public.award_challenge_points(
    '00000000-0000-4000-c000-000000000002',
    array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          '11111111-1111-4111-8111-111111111111']::uuid[],
    100),
  3,
  'award_challenge_points returns the number of players awarded'
);

select is(
  (select count(*)::int from public.points_ledger
   where source_type = 'challenge' and source_id = '00000000-0000-4000-c000-000000000002'),
  3,
  'awarding 3 players creates 3 ledger rows'
);

-- Fix a mistake: same team gets 50 instead of 100.
select public.award_challenge_points(
  '00000000-0000-4000-c000-000000000002',
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111']::uuid[],
  50);

select results_eq(
  $$ select count(*)::int, sum(points)::int from public.points_ledger
     where source_type = 'challenge' and source_id = '00000000-0000-4000-c000-000000000002' $$,
  $$ values (3, 150) $$,
  're-awarding overwrites instead of adding'
);

select results_eq(
  $$ select total from public.party_leaderboard
     where player_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (50) $$,
  'host appears in the party leaderboard with her challenge points'
);

select * from finish();
rollback;
