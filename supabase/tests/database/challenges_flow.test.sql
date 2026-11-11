-- Challenge flow: start/finish, one active challenge, delete guard,
-- content validation (DECISIONS 033).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('11111111-1111-4111-8111-111111111111', 'Host', '👑'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱');
insert into public.hosts (user_id) values ('11111111-1111-4111-8111-111111111111');

-- Known challenges, independent of seed.sql.
delete from public.challenges;
insert into public.challenges (id, position, name) values
  ('00000000-0000-4000-c000-0000000000a1', 1, 'Prova A'),
  ('00000000-0000-4000-c000-0000000000a2', 2, 'Prova B');

set local role authenticated;

-- Guests ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.start_challenge('00000000-0000-4000-c000-0000000000a1') $$,
  'P0001', 'Only the host can do this',
  'guest cannot start a challenge'
);

select throws_ok(
  $$ select public.finish_challenge() $$,
  'P0001', 'Only the host can do this',
  'guest cannot finish a challenge'
);

select throws_ok(
  $$ insert into public.challenges (position, name) values (9, 'Hack') $$,
  '42501', null,
  'guest cannot create challenges'
);

-- Host ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.start_challenge('00000000-0000-4000-c000-0000000000a1') $$,
  'P0001', 'Not in the challenges phase',
  'a challenge only starts in the challenges phase'
);

update public.party_state set phase = 'challenges' where id = 1;

select lives_ok(
  $$ select public.start_challenge('00000000-0000-4000-c000-0000000000a1') $$,
  'host starts a challenge'
);

select results_eq(
  $$ select current_challenge_id from public.party_state $$,
  $$ values ('00000000-0000-4000-c000-0000000000a1'::uuid) $$,
  'the started challenge becomes the current one'
);

select public.start_challenge('00000000-0000-4000-c000-0000000000a2');

select results_eq(
  $$ select id::text, status from public.challenges order by position $$,
  $$ values ('00000000-0000-4000-c000-0000000000a1', 'done'),
            ('00000000-0000-4000-c000-0000000000a2', 'active') $$,
  'starting another challenge finishes the previous one'
);

select throws_ok(
  $$ update public.challenges set status = 'active'
     where id = '00000000-0000-4000-c000-0000000000a1' $$,
  '23505', null,
  'only one challenge can be active'
);

select public.finish_challenge();

select results_eq(
  $$ select (select current_challenge_id from public.party_state),
            (select count(*)::int from public.challenges where status = 'active') $$,
  $$ values (null::uuid, 0) $$,
  'finish_challenge clears the current challenge'
);

-- Delete guard --------------------------------------------------------------
select public.award_challenge_points(
  '00000000-0000-4000-c000-0000000000a1',
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[], 100);

delete from public.challenges where id = '00000000-0000-4000-c000-0000000000a1';

select is(
  (select count(*)::int from public.challenges where id = '00000000-0000-4000-c000-0000000000a1'),
  1,
  'a challenge with points cannot be deleted'
);

delete from public.challenges where id = '00000000-0000-4000-c000-0000000000a2';

select is(
  (select count(*)::int from public.challenges where id = '00000000-0000-4000-c000-0000000000a2'),
  0,
  'a challenge without points can be deleted'
);

-- Host removes the points (fixing a mistake), then the delete works.
delete from public.points_ledger
where source_type = 'challenge' and source_id = '00000000-0000-4000-c000-0000000000a1';
delete from public.challenges where id = '00000000-0000-4000-c000-0000000000a1';

select is(
  (select count(*)::int from public.challenges),
  0,
  'once its points are removed, the challenge can be deleted'
);

-- Validation ----------------------------------------------------------------
select lives_ok(
  $$ insert into public.challenges (position, name, emoji, description)
     values (1, 'Cursa de sacs', '🛍️', 'Saltant fins a la meta.') $$,
  'host creates a challenge'
);

select throws_ok(
  $$ insert into public.challenges (position, name) values (2, '   ') $$,
  '23514', null,
  'a challenge needs a name'
);

select throws_ok(
  $$ insert into public.challenges (position, name, description)
     values (3, 'Llarga', repeat('x', 201)) $$,
  '23514', null,
  'descriptions are at most 200 characters'
);

select * from finish();
rollback;
