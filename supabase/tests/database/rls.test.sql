-- RLS: what guests can and cannot see or write directly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('11111111-1111-4111-8111-111111111111', 'Host', '👑'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱');
insert into public.hosts (user_id) values ('11111111-1111-4111-8111-111111111111');

-- No session (anon role): no access at all ----------------------------------
set local role anon;

select throws_ok(
  $$ select * from public.players $$,
  '42501', null,
  'anon role cannot read tables'
);

-- Guest, lobby: questions are hidden -----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select is((select count(*)::int from public.quiz_questions), 0, 'guest sees no questions before they open');
select is((select count(*)::int from public.quiz_keys), 0, 'guest sees no answers before the reveal');

select throws_ok(
  $$ insert into public.points_ledger (player_id, points, source_type, source_id)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1000, 'quiz', gen_random_uuid()) $$,
  '42501', null,
  'guest cannot write points directly'
);

-- A guest's update to party_state matches no rows (RLS filters it out).
update public.party_state set phase = 'finished';

-- Host opens question 1 -----------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is((select phase from public.party_state), 'lobby', 'guest cannot change the party phase');
select is((select count(*)::int from public.quiz_keys), 3, 'host sees all answers');

select throws_ok(
  $$ update public.party_state set question_status = 'revealed' $$,
  '42501', null,
  'host cannot change question status directly (column grant)'
);

select public.open_question('00000000-0000-4000-a000-000000000001');

-- Guest sees only the current question, still without the answer ------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select results_eq(
  $$ select id from public.quiz_questions $$,
  $$ values ('00000000-0000-4000-a000-000000000001'::uuid) $$,
  'guest sees only the open question'
);
select is((select count(*)::int from public.quiz_keys), 0, 'guest still cannot see the answer while open');

select * from finish();
rollback;
