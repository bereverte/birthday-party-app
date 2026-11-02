-- Quiz rules: late answers, host answering, idempotent closing, score formula.
-- Each file runs in a transaction that is rolled back, so the database stays clean.
-- To act as a user we do what Supabase does on every request: switch to the
-- `authenticated` role and put the user id in request.jwt.claims.
-- Note: now() is frozen inside a transaction, so timestamps are set explicitly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Users: one host (H) and three guests (A, B, C).
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

-- Question 1 (seed) opened 5 seconds ago, 20 s limit.
update public.party_state set
  phase = 'quiz',
  current_question_id = '00000000-0000-4000-a000-000000000001',
  question_status = 'open',
  question_opened_at = now() - interval '5 seconds',
  question_closes_at = now() + interval '15 seconds';

-- Host --------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000011') $$,
  'P0001', 'The host cannot answer the quiz',
  'host cannot answer the quiz'
);

-- Anna: correct answer ----------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000011') $$,
  'guest can answer an open question'
);

select throws_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000012') $$,
  'P0001', 'You already answered this question',
  'guest cannot answer twice'
);

select throws_ok(
  $$ select public.close_question() $$,
  'P0001', 'Only the host can do this',
  'guest cannot close a question'
);

-- Biel: wrong answer ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000013') $$,
  'guest can answer wrong'
);

-- Host closes, twice ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select public.close_question();

-- 5 s out of 20 s: 500 + round(500 * (1 - 5/20)) = 875. Wrong answers get no row.
select results_eq(
  $$ select player_id, points from public.points_ledger where source_type = 'quiz' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 875) $$,
  'close_question awards correct points plus speed bonus, only to correct answers'
);

select lives_ok($$ select public.close_question() $$, 'closing again does not fail');

select is(
  (select count(*)::int from public.points_ledger where source_type = 'quiz'),
  1,
  'closing twice does not duplicate points'
);

-- Carla: closed question and late answer ---------------------------------
select set_config('request.jwt.claims', '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000011') $$,
  'P0001', 'This question is not open',
  'answer to a closed question is rejected'
);

-- Question 2 is still marked open, but its time ran out 10 s ago
-- (the host's device hasn't called close_question yet).
reset role;
update public.party_state set
  current_question_id = '00000000-0000-4000-a000-000000000002',
  question_status = 'open',
  question_opened_at = now() - interval '30 seconds',
  question_closes_at = now() - interval '10 seconds';
set local role authenticated;

select throws_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000024') $$,
  'P0001', 'Time is up',
  'answer after the time limit is rejected'
);

select throws_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000011') $$,
  'P0001', 'This question is not open',
  'answer for a question that is not the current one is rejected'
);

select * from finish();
rollback;
