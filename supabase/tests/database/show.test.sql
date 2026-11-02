-- Show rules: no self-voting, one vote per person, score = avg * points per star.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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

-- Anna signs up a duet with Biel -----------------------------------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select public.sign_up_act('Duet', array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[]);

select is(
  (select count(*)::int from public.show_act_members m
   join public.show_acts a on a.id = m.act_id where a.title = 'Duet'),
  2,
  'sign_up_act adds the caller and the chosen partners as members'
);

select throws_ok(
  $$ select public.cast_vote((select id from public.show_acts where title = 'Duet'), 5) $$,
  'P0001', 'Voting is not open for this act',
  'cannot vote before voting opens'
);

-- Host opens voting (direct update allowed by RLS for the host) ----------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
update public.show_acts set status = 'voting' where title = 'Duet';

-- Members cannot vote for their own act ----------------------------------
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.cast_vote((select id from public.show_acts where title = 'Duet'), 5) $$,
  'P0001', 'You cannot vote for your own act',
  'act creator cannot vote for their own act'
);

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.cast_vote((select id from public.show_acts where title = 'Duet'), 5) $$,
  'P0001', 'You cannot vote for your own act',
  'act partner cannot vote for their own act'
);

-- Carla votes 3, then changes to 4; the host votes 5 ----------------------
select set_config('request.jwt.claims', '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.cast_vote((select id from public.show_acts where title = 'Duet'), 3) $$,
  'non-member can vote'
);
select public.cast_vote((select id from public.show_acts where title = 'Duet'), 4);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select public.cast_vote((select id from public.show_acts where title = 'Duet'), 5);

select is(
  (select count(*)::int from public.show_votes),
  2,
  'voting again replaces the vote instead of adding one'
);

-- Close: avg(4, 5) = 4.5 * 100 = 450 for each member ---------------------
select public.close_voting((select id from public.show_acts where title = 'Duet'));

select results_eq(
  $$ select player_id, points from public.points_ledger
     where source_type = 'show' order by player_id $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 450),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 450) $$,
  'close_voting gives avg * points per star to each member'
);

select * from finish();
rollback;
