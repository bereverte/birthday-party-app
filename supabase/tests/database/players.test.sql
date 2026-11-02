-- Removing players: only the host, and only players without activity.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('11111111-1111-4111-8111-111111111111', 'Host', '👑'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Anna again', '🐱'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Carles', '🦊');
insert into public.hosts (user_id) values ('11111111-1111-4111-8111-111111111111');
insert into public.points_ledger (player_id, points, source_type, source_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100, 'challenge', gen_random_uuid());

set local role authenticated;

-- Guest: delete matches no rows -----------------------------------------------
select set_config('request.jwt.claims', '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}', true);
delete from public.players where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select count(*)::int from public.players where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1, 'guest cannot remove players'
);

-- Host ------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

delete from public.players where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select count(*)::int from public.players where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0, 'host removes a player without activity'
);

delete from public.players where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select count(*)::int from public.players where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1, 'host cannot remove a player who has points'
);
select is(
  (select count(*)::int from public.points_ledger where player_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1, 'their points are kept'
);

select * from finish();
rollback;
