-- Multi-select and number questions (DECISIONS 031): answer validation,
-- the proportional multi score, the off-by-one number score, the speed
-- bonus on the new kinds and the hidden number key.
-- Scores below use quiz_correct_points = 500 and quiz_max_speed_bonus = 500
-- (scoring_config from the schema migration). now() is frozen inside the
-- transaction, so every answer has answered_at = now().
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Users: host H and guests A–F.
insert into auth.users (id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'authenticated', 'authenticated'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'authenticated', 'authenticated'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('11111111-1111-4111-8111-111111111111', 'Host', '👑'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Biel', '🐶'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Carla', '🦊'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Dani', '🐸'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Eva', '🐼'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Ferran', '🐯');
insert into public.hosts (user_id) values ('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$ insert into public.quiz_questions (position, text, kind) values (99, 'No max', 'number') $$,
  '23514', null,
  'a number question needs number_max'
);

-- Multi: 6 options, 4 correct (1–4) and 2 wrong (5–6).
insert into public.quiz_questions (id, position, text, kind, time_limit_s) values
  ('00000000-0000-4000-a000-000000000101', 101, 'Quins instruments ha tocat?', 'multi', 20);
insert into public.quiz_options (id, question_id, position, text) values
  ('00000000-0000-4000-b000-000000001011', '00000000-0000-4000-a000-000000000101', 1, 'Piano'),
  ('00000000-0000-4000-b000-000000001012', '00000000-0000-4000-a000-000000000101', 2, 'Guitarra'),
  ('00000000-0000-4000-b000-000000001013', '00000000-0000-4000-a000-000000000101', 3, 'Flauta'),
  ('00000000-0000-4000-b000-000000001014', '00000000-0000-4000-a000-000000000101', 4, 'Ukelele'),
  ('00000000-0000-4000-b000-000000001015', '00000000-0000-4000-a000-000000000101', 5, 'Saxo'),
  ('00000000-0000-4000-b000-000000001016', '00000000-0000-4000-a000-000000000101', 6, 'Bateria');
insert into public.quiz_keys (question_id, correct_option_id) values
  ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-b000-000000001011'),
  ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-b000-000000001012'),
  ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-b000-000000001013'),
  ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-b000-000000001014');

-- Opened 20 s ago with a 20 s limit: speed = 0, so points = f * 500.
update public.party_state set
  phase = 'quiz',
  current_question_id = '00000000-0000-4000-a000-000000000101',
  question_status = 'open',
  question_opened_at = now() - interval '20 seconds',
  question_closes_at = now() + interval '1 second';

set local role authenticated;

-- Anna: the 4 correct → 4/4 − 0/2 = 100 %.
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000101', array[
       '00000000-0000-4000-b000-000000001011', '00000000-0000-4000-b000-000000001012',
       '00000000-0000-4000-b000-000000001013', '00000000-0000-4000-b000-000000001014']::uuid[]) $$,
  'multi: guest marks the 4 correct options'
);
select throws_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000101', array['00000000-0000-4000-b000-000000001011']::uuid[]) $$,
  'P0001', 'You already answered this question',
  'multi: guest cannot answer twice'
);

-- Biel: 3 correct (one repeated, counted once) → 3/4 = 75 %.
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000101', array[
       '00000000-0000-4000-b000-000000001011', '00000000-0000-4000-b000-000000001011',
       '00000000-0000-4000-b000-000000001012', '00000000-0000-4000-b000-000000001013']::uuid[]) $$,
  'multi: guest marks 3 correct options'
);

-- Carla: 4 correct + 1 wrong → 4/4 − 1/2 = 50 %.
select set_config('request.jwt.claims', '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000101', array[
       '00000000-0000-4000-b000-000000001011', '00000000-0000-4000-b000-000000001012',
       '00000000-0000-4000-b000-000000001013', '00000000-0000-4000-b000-000000001014',
       '00000000-0000-4000-b000-000000001015']::uuid[]) $$,
  'multi: guest marks 4 correct and 1 wrong'
);

-- Dani: all 6 → 4/4 − 2/2 = 0 %, no ledger row.
select set_config('request.jwt.claims', '{"sub": "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000101', array[
       '00000000-0000-4000-b000-000000001011', '00000000-0000-4000-b000-000000001012',
       '00000000-0000-4000-b000-000000001013', '00000000-0000-4000-b000-000000001014',
       '00000000-0000-4000-b000-000000001015', '00000000-0000-4000-b000-000000001016']::uuid[]) $$,
  'multi: guest marks every option'
);

-- Eva: invalid answers.
select set_config('request.jwt.claims', '{"sub": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000101', array['00000000-0000-4000-b000-000000000011']::uuid[]) $$,
  'P0001', 'Invalid option',
  'multi: an option from another question is rejected'
);
select throws_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000101', array[]::uuid[]) $$,
  'P0001', 'Pick at least one option',
  'multi: an empty answer is rejected'
);
select throws_ok(
  $$ select public.submit_answer('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-b000-000000001011') $$,
  'P0001', 'Wrong answer type for this question',
  'multi: a single-option answer is rejected'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select public.close_question();

select results_eq(
  $$ select player_id, points from public.points_ledger
     where source_id = '00000000-0000-4000-a000-000000000101' order by points desc $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 500),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 375),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 250) $$,
  'multi: 100 % / 75 % / 50 %, and marking everything scores nothing'
);

-- Number: max 10, answer 3.
reset role;
insert into public.quiz_questions (id, position, text, kind, number_max, time_limit_s) values
  ('00000000-0000-4000-a000-000000000102', 102, 'Quants tatuatges s''ha fet ella mateixa?', 'number', 10, 20);
insert into public.quiz_number_keys (question_id, value) values
  ('00000000-0000-4000-a000-000000000102', 3);

-- Opened 10 s ago with a 20 s limit: speed = 0.5, so a full score is
-- 500 + 500 * 0.5 = 750 and a half score 375.
update public.party_state set
  current_question_id = '00000000-0000-4000-a000-000000000102',
  question_status = 'open',
  question_opened_at = now() - interval '10 seconds',
  question_closes_at = now() + interval '10 seconds';
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
select is((select count(*)::int from public.quiz_number_keys), 0, 'number: guest cannot see the answer while open');
select lives_ok($$ select public.submit_number_answer('00000000-0000-4000-a000-000000000102', 3) $$, 'number: exact answer');

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);
select lives_ok($$ select public.submit_number_answer('00000000-0000-4000-a000-000000000102', 4) $$, 'number: one too many');

select set_config('request.jwt.claims', '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}', true);
select lives_ok($$ select public.submit_number_answer('00000000-0000-4000-a000-000000000102', 2) $$, 'number: one too few');

select set_config('request.jwt.claims', '{"sub": "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "role": "authenticated"}', true);
select lives_ok($$ select public.submit_number_answer('00000000-0000-4000-a000-000000000102', 5) $$, 'number: two away');

select set_config('request.jwt.claims', '{"sub": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.submit_number_answer('00000000-0000-4000-a000-000000000102', 11) $$,
  'P0001', 'Number out of range',
  'number: above the maximum is rejected'
);
select throws_ok(
  $$ select public.submit_number_answer('00000000-0000-4000-a000-000000000102', -1) $$,
  'P0001', 'Number out of range',
  'number: below 0 is rejected'
);

select set_config('request.jwt.claims', '{"sub": "ffffffff-ffff-4fff-8fff-ffffffffffff", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.submit_multi_answer('00000000-0000-4000-a000-000000000102', array['00000000-0000-4000-b000-000000001011']::uuid[]) $$,
  'P0001', 'Wrong answer type for this question',
  'number: a multi answer is rejected'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select public.close_question();

select results_eq(
  $$ select player_id, points from public.points_ledger
     where source_id = '00000000-0000-4000-a000-000000000102' order by points desc, player_id $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 750),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 375),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 375) $$,
  'number: exact 100 %, off by one 50 %, further 0, with the speed bonus'
);

select public.reveal_question();

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
select results_eq(
  $$ select value from public.quiz_number_keys $$,
  $$ values (3) $$,
  'number: guest sees the answer after the reveal'
);

select * from finish();
rollback;
