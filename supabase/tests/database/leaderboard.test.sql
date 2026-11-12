-- Global leaderboard (DECISIONS 035): quiz + challenges + best show act,
-- guests only.
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

-- source_id isn't a foreign key, so plain ids are enough here.
insert into public.points_ledger (player_id, points, source_type, source_id) values
  -- Anna: quiz 800 + challenge 3000 + two acts (1200 and 900) → 5000
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',  800, 'quiz',      '00000000-0000-4000-a000-000000000001'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 3000, 'challenge', '00000000-0000-4000-c000-000000000001'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1200, 'show',      '00000000-0000-4000-d000-000000000001'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',  900, 'show',      '00000000-0000-4000-d000-000000000002'),
  -- Biel: two quiz questions → 5000 (ties with Anna)
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2500, 'quiz',      '00000000-0000-4000-a000-000000000001'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2500, 'quiz',      '00000000-0000-4000-a000-000000000002'),
  -- Host: plays a challenge and an act
  ('11111111-1111-4111-8111-111111111111', 3000, 'challenge', '00000000-0000-4000-c000-000000000002'),
  ('11111111-1111-4111-8111-111111111111', 1500, 'show',      '00000000-0000-4000-d000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}', true);

select results_eq(
  $$ select total from public.leaderboard where player_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (5000) $$,
  'total adds quiz, challenges and only the best show act'
);

select results_eq(
  $$ select total from public.leaderboard where player_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  $$ values (5000) $$,
  'quiz and challenge points are summed, not maxed'
);

select results_eq(
  $$ select total, rank from public.leaderboard where player_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
  $$ values (0, 3) $$,
  'a guest without points appears with 0, after the tie'
);

select results_eq(
  $$ select count(*)::int from public.leaderboard where rank = 1 $$,
  $$ values (2) $$,
  'ties share the same rank'
);

select is_empty(
  $$ select 1 from public.leaderboard where player_id = '11111111-1111-4111-8111-111111111111' $$,
  'the host is not in the global leaderboard'
);

select * from finish();
rollback;
