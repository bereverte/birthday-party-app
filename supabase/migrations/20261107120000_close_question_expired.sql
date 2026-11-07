-- close_question: any player may close a question once its time is up
-- (DECISIONS 030). When the countdown reaches 0 every phone calls it, so the
-- question closes even if the host's device is asleep.
--
-- Concurrency: the FOR UPDATE lock on party_state queues the ~30 parallel
-- calls. The first one closes and scores; the rest see 'closed' and return.
-- The expiry check reads question_closes_at from the locked row.
--
-- Returns true when the question is closed (by this call or earlier), false
-- when a guest calls too early (e.g. a phone clock running ahead). "Too
-- early" is not an error: the client just retries a second later.
-- The return type changes, so the function is dropped and recreated.

drop function public.close_question();

create function public.close_question()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.party_state;
begin
  select * into v_state from public.party_state where id = 1 for update;

  if v_state.question_status <> 'open' then
    return true;
  end if;

  if not public.is_host() and now() < v_state.question_closes_at then
    return false;
  end if;

  update public.party_state
  set question_status    = 'closed',
      question_closes_at = least(question_closes_at, now())
  where id = 1;

  insert into public.points_ledger (player_id, points, source_type, source_id)
  select
    a.player_id,
    c.quiz_correct_points + round(
      c.quiz_max_speed_bonus * greatest(0, least(1,
        1 - extract(epoch from (a.answered_at - v_state.question_opened_at))
            / q.time_limit_s
      ))
    )::int,
    'quiz',
    a.question_id
  from public.quiz_answers a
  join public.quiz_questions q on q.id = a.question_id
  join public.quiz_keys k
    on k.question_id = a.question_id and k.correct_option_id = a.option_id
  cross join public.scoring_config c
  where a.question_id = v_state.current_question_id
  on conflict (player_id, source_type, source_id) do nothing;

  return true;
end;
$$;

revoke execute on function public.close_question() from public, anon;
grant execute on function public.close_question() to authenticated;
