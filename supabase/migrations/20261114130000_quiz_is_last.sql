-- Guests only see the current question (RLS), so they can't tell on their
-- own whether more questions follow. This answers just that, without
-- revealing anything about the next ones. Used to show the quiz podium
-- after the last question (DECISIONS 035).
create function public.is_last_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.quiz_questions later
    where later.position > (
      select q.position from public.quiz_questions q where q.id = p_question_id
    )
  );
$$;

revoke execute on function public.is_last_question(uuid) from public, anon;
grant execute on function public.is_last_question(uuid) to authenticated;
