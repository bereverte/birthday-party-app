-- Show flow: start/open/close, one act on stage, withdraw, delete guard
-- (DECISIONS 034).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('11111111-1111-4111-8111-111111111111', 'Host', '👑'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Biel', '🐶');
insert into public.hosts (user_id) values ('11111111-1111-4111-8111-111111111111');

insert into public.show_acts (id, title, created_by, position) values
  ('00000000-0000-4000-a000-0000000000a1', 'Solo Anna', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1),
  ('00000000-0000-4000-a000-0000000000a2', 'Solo Biel', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2),
  ('00000000-0000-4000-a000-0000000000a3', 'Spare', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 3);
insert into public.show_act_members (act_id, player_id) values
  ('00000000-0000-4000-a000-0000000000a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('00000000-0000-4000-a000-0000000000a2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('00000000-0000-4000-a000-0000000000a3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

set local role authenticated;

-- Guests ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.start_act('00000000-0000-4000-a000-0000000000a1') $$,
  'P0001', 'Only the host can do this',
  'guest cannot start an act'
);

select throws_ok(
  $$ select public.open_voting() $$,
  'P0001', 'Only the host can do this',
  'guest cannot open voting'
);

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.withdraw_act('00000000-0000-4000-a000-0000000000a1') $$,
  'P0001', 'Only its creator can withdraw this act',
  'guest cannot withdraw someone else''s act'
);

-- Host: phase guard -------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.start_act('00000000-0000-4000-a000-0000000000a1') $$,
  'P0001', 'Not in the show phase',
  'acts only start in the show phase'
);

update public.party_state set phase = 'show' where id = 1;

select throws_ok(
  $$ select public.open_voting() $$,
  'P0001', 'No act is performing',
  'cannot open voting with nothing on stage'
);

-- Start A, then switch to B while A is still performing ------------------
select public.start_act('00000000-0000-4000-a000-0000000000a1');
select public.start_act('00000000-0000-4000-a000-0000000000a2');

select results_eq(
  $$ select title, status from public.show_acts where position <= 2 order by position $$,
  $$ values ('Solo Anna', 'pending'), ('Solo Biel', 'performing') $$,
  'starting another act sends the performing one back to pending'
);

select is(
  (select current_act_id from public.party_state),
  '00000000-0000-4000-a000-0000000000a2'::uuid,
  'start_act sets current_act_id'
);

-- Anna cannot vote while Biel is still performing --------------------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.cast_vote('00000000-0000-4000-a000-0000000000a2', 5) $$,
  'P0001', 'Voting is not open for this act',
  'no votes while the act is performing'
);

-- Open voting; another act cannot start until it is closed ----------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select public.open_voting();

select throws_ok(
  $$ select public.start_act('00000000-0000-4000-a000-0000000000a1') $$,
  'P0001', 'Close the voting first',
  'cannot start another act while one is being voted'
);

select throws_ok(
  $$ update public.show_acts set status = 'performing' where id = '00000000-0000-4000-a000-0000000000a1' $$,
  '23505', null,
  'unique index allows only one act on stage'
);

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
select public.cast_vote('00000000-0000-4000-a000-0000000000a2', 4);

select throws_ok(
  $$ select public.withdraw_act('00000000-0000-4000-a000-0000000000a2') $$,
  'P0001', 'Only its creator can withdraw this act',
  'withdraw is refused for others even while voting'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select public.close_voting('00000000-0000-4000-a000-0000000000a2');

select is(
  (select points from public.points_ledger
   where source_type = 'show' and source_id = '00000000-0000-4000-a000-0000000000a2'),
  400,
  'closing scores the act (4 stars * 100)'
);

-- Delete guard -------------------------------------------------------------
delete from public.show_acts where id = '00000000-0000-4000-a000-0000000000a2';

select is(
  (select count(*)::int from public.show_acts where id = '00000000-0000-4000-a000-0000000000a2'),
  1,
  'host cannot delete an act that has points'
);

-- Withdraw -----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.withdraw_act('00000000-0000-4000-a000-0000000000a2') $$,
  'P0001', 'This act has already been on stage',
  'cannot withdraw an act that has been on stage'
);

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
select public.withdraw_act('00000000-0000-4000-a000-0000000000a3');

select is(
  (select count(*)::int from public.show_act_members where act_id = '00000000-0000-4000-a000-0000000000a3'),
  0,
  'creator withdraws a pending act and its members go with it'
);

-- Host can restart a done act to redo it -----------------------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.start_act('00000000-0000-4000-a000-0000000000a2') $$,
  'a done act can be started again'
);

select * from finish();
rollback;
