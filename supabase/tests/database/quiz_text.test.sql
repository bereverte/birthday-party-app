-- Written-answer questions and reveal images (DECISIONS 032): normalizing,
-- full and half credit from the accepted list, everything else 0, answer
-- validation, and the spoilers (answers, image) hidden until the reveal.
-- Opened 20 s ago with a 20 s limit: speed = 0, so points = credit * 500.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

select is(public.normalize_answer(' Pérez-L''Anna. '), 'perezlanna', 'normalize: lower case, no accents, only letters and digits');

insert into public.quiz_questions (id, position, text, kind, time_limit_s) values
  ('00000000-0000-4000-a000-000000000201', 201, 'Com es diu el seu millor company de vida?', 'text', 20);
insert into public.quiz_text_keys (question_id, position, answer, credit) values
  ('00000000-0000-4000-a000-000000000201', 1, 'Nuc', 1),
  ('00000000-0000-4000-a000-000000000201', 2, 'Nuk', 0.5),
  ('00000000-0000-4000-a000-000000000201', 3, 'Nuck', 0.5);
insert into public.quiz_reveal_images (question_id, image_url) values
  ('00000000-0000-4000-a000-000000000201', 'https://example.com/nuc.jpg');

update public.party_state set
  phase = 'quiz',
  current_question_id = '00000000-0000-4000-a000-000000000201',
  question_status = 'open',
  question_opened_at = now() - interval '20 seconds',
  question_closes_at = now() + interval '1 second';

set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
select is((select count(*)::int from public.quiz_text_keys), 0, 'text: guest cannot see the answers while open');
select is((select count(*)::int from public.quiz_reveal_images), 0, 'text: guest cannot see the reveal image while open');
select lives_ok($$ select public.submit_text_answer('00000000-0000-4000-a000-000000000201', '  NUC ') $$, 'text: upper case with spaces');

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);
select lives_ok($$ select public.submit_text_answer('00000000-0000-4000-a000-000000000201', 'Nuk') $$, 'text: a half-credit spelling');

select set_config('request.jwt.claims', '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}', true);
select lives_ok($$ select public.submit_text_answer('00000000-0000-4000-a000-000000000201', 'nuck.') $$, 'text: another half-credit spelling, with a dot');

select set_config('request.jwt.claims', '{"sub": "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "role": "authenticated"}', true);
select lives_ok($$ select public.submit_text_answer('00000000-0000-4000-a000-000000000201', 'Luc') $$, 'text: one letter away but not in the list');

select set_config('request.jwt.claims', '{"sub": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "role": "authenticated"}', true);
select lives_ok($$ select public.submit_text_answer('00000000-0000-4000-a000-000000000201', 'Núc') $$, 'text: with an accent');

select set_config('request.jwt.claims', '{"sub": "ffffffff-ffff-4fff-8fff-ffffffffffff", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.submit_text_answer('00000000-0000-4000-a000-000000000201', ' ?! ') $$,
  'P0001', 'Write an answer',
  'text: an answer with no letters is rejected'
);
select throws_ok(
  $$ select public.submit_text_answer('00000000-0000-4000-a000-000000000201', repeat('a', 61)) $$,
  'P0001', 'Answer too long',
  'text: more than 60 characters is rejected'
);
select throws_ok(
  $$ select public.submit_number_answer('00000000-0000-4000-a000-000000000201', 3) $$,
  'P0001', 'Wrong answer type for this question',
  'text: a number answer is rejected'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select public.close_question();

select results_eq(
  $$ select player_id, points from public.points_ledger
     where source_id = '00000000-0000-4000-a000-000000000201' order by points desc, player_id $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 500),
            ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 500),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 250),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 250) $$,
  'text: full answers 100 %, listed spellings 50 %, anything else 0'
);

select public.reveal_question();

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
select is((select count(*)::int from public.quiz_text_keys), 3, 'text: guest sees the answers after the reveal');
select is((select image_url from public.quiz_reveal_images), 'https://example.com/nuc.jpg', 'text: guest sees the reveal image after the reveal');

select * from finish();
rollback;
