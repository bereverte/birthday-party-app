-- is_last_question: guests learn whether more questions follow, without
-- being able to read them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated');
insert into public.players (id, name, emoji) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anna', '🐱');

-- Two questions after whatever the seed has.
insert into public.quiz_questions (id, position, text) values
  ('00000000-0000-4000-a000-00000000f001', 1000, 'Penultimate'),
  ('00000000-0000-4000-a000-00000000f002', 1001, 'Last');

update public.party_state set
  phase = 'quiz',
  current_question_id = '00000000-0000-4000-a000-00000000f001',
  question_status = 'revealed';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.quiz_questions where position > 1000 $$,
  'a guest still cannot read the next question'
);

select is(
  public.is_last_question('00000000-0000-4000-a000-00000000f001'),
  false,
  'a question with another one after it is not the last'
);

select is(
  public.is_last_question('00000000-0000-4000-a000-00000000f002'),
  true,
  'the question with the highest position is the last'
);

reset role;
select is(
  (select has_function_privilege('anon', 'public.is_last_question(uuid)', 'execute')),
  false,
  'anon cannot call is_last_question'
);

select * from finish();
rollback;
