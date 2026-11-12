-- quiz_podium: only the host can switch every phone to the quiz podium.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('11111111-1111-4111-8111-111111111111', 'Host', '👑'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱');
insert into public.hosts (user_id) values ('11111111-1111-4111-8111-111111111111');

set local role authenticated;

-- A guest's update matches no row (RLS), so nothing changes.
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
update public.party_state set quiz_podium = true where id = 1;
select is((select quiz_podium from public.party_state), false, 'a guest cannot show the quiz podium');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
update public.party_state set quiz_podium = true where id = 1;
select is((select quiz_podium from public.party_state), true, 'the host can show the quiz podium');

update public.party_state set quiz_podium = false where id = 1;
select is((select quiz_podium from public.party_state), false, 'the host can hide it again');

select * from finish();
rollback;
