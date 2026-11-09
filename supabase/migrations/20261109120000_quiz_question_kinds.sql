-- Two new question kinds (DECISIONS 031):
--   multi:  several correct options; the guest marks some and confirms.
--   number: the guest picks a number from 0 to number_max with − / +.
-- 'single' (one correct option) stays the default, so existing questions
-- and submit_answer keep working.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.quiz_questions
  add column kind text not null default 'single'
    check (kind in ('single', 'multi', 'number')),
  add column number_max int check (number_max between 1 and 100),
  -- The counter's maximum exists exactly for number questions.
  add constraint quiz_questions_number_max_kind_check
    check ((kind = 'number') = (number_max is not null));

-- Several correct options per question (multi): one key row per option.
alter table public.quiz_keys
  drop constraint quiz_keys_pkey,
  add primary key (question_id, correct_option_id);

-- The correct number, kept apart from the question (which guests can read
-- while it's open) with the same visibility as quiz_keys.
create table public.quiz_number_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  value       int  not null check (value >= 0)
);

-- Still one row per player and question: "already answered", the host's
-- counter, Realtime and answered_at (speed bonus) work the same for every
-- kind. Exactly one answer column is filled, the one for the question's kind.
-- option_id keeps its composite FK (NULL skips it); option_ids and
-- number_value are validated by their submit functions.
alter table public.quiz_answers
  alter column option_id drop not null,
  add column option_ids   uuid[],
  add column number_value int,
  add constraint quiz_answers_one_value_check
    check (num_nonnulls(option_id, option_ids, number_value) = 1);

-- ---------------------------------------------------------------------------
-- RLS for quiz_number_keys: same rules as quiz_keys.
-- ---------------------------------------------------------------------------

alter table public.quiz_number_keys enable row level security;

create policy "number key is visible to host or after reveal"
  on public.quiz_number_keys for select to authenticated
  using (
    (select public.is_host())
    or question_id = (
      select current_question_id from public.party_state
      where question_status = 'revealed'
    )
  );

create policy "host manages number keys"
  on public.quiz_number_keys for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

-- ---------------------------------------------------------------------------
-- Answering. The shared checks live in one internal helper; each kind has
-- its own small, typed RPC.
-- ---------------------------------------------------------------------------

-- Who may answer, and whether the question is open. Takes the FOR SHARE lock
-- on party_state (held until the transaction ends): close_question waits
-- for in-flight answers, so none slips in after the scoring.
create function public.assert_can_answer(p_question_id uuid, p_kind text)
returns public.quiz_questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state    public.party_state;
  v_question public.quiz_questions;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if public.is_host() then
    raise exception 'The host cannot answer the quiz';
  end if;

  if not exists (select 1 from public.players where id = auth.uid()) then
    raise exception 'Join the party first';
  end if;

  select * into v_state from public.party_state where id = 1 for share;

  if v_state.current_question_id is distinct from p_question_id
     or v_state.question_status <> 'open' then
    raise exception 'This question is not open';
  end if;

  if now() > v_state.question_closes_at then
    raise exception 'Time is up';
  end if;

  select * into v_question from public.quiz_questions where id = p_question_id;

  if v_question.kind <> p_kind then
    raise exception 'Wrong answer type for this question';
  end if;

  return v_question;
end;
$$;

-- Same signature as before, now through the shared checks.
create or replace function public.submit_answer(p_question_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can_answer(p_question_id, 'single');

  if not exists (
    select 1 from public.quiz_options
    where id = p_option_id and question_id = p_question_id
  ) then
    raise exception 'Invalid option';
  end if;

  insert into public.quiz_answers (question_id, player_id, option_id)
  values (p_question_id, auth.uid(), p_option_id)
  on conflict do nothing;

  if not found then
    raise exception 'You already answered this question';
  end if;
end;
$$;

create function public.submit_multi_answer(p_question_id uuid, p_option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform public.assert_can_answer(p_question_id, 'multi');

  -- Duplicates would count one option twice in the score.
  select array_agg(distinct x) into v_ids from unnest(p_option_ids) as x where x is not null;

  if v_ids is null then
    raise exception 'Pick at least one option';
  end if;

  if (
    select count(*) from public.quiz_options
    where question_id = p_question_id and id = any (v_ids)
  ) <> cardinality(v_ids) then
    raise exception 'Invalid option';
  end if;

  insert into public.quiz_answers (question_id, player_id, option_ids)
  values (p_question_id, auth.uid(), v_ids)
  on conflict do nothing;

  if not found then
    raise exception 'You already answered this question';
  end if;
end;
$$;

create function public.submit_number_answer(p_question_id uuid, p_value int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.quiz_questions;
begin
  v_question := public.assert_can_answer(p_question_id, 'number');

  if p_value is null or p_value < 0 or p_value > v_question.number_max then
    raise exception 'Number out of range';
  end if;

  insert into public.quiz_answers (question_id, player_id, number_value)
  values (p_question_id, auth.uid(), p_value)
  on conflict do nothing;

  if not found then
    raise exception 'You already answered this question';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scoring. Every answer gets a fraction f between 0 and 1:
--   single: 1 if it's the correct option, else 0.
--   multi:  marked correct / all correct − marked wrong / all wrong, min 0.
--           Marking everything is always 1 − 1 = 0, whatever the mix; with
--           no wrong options the second part is 0.
--   number: exact 1, off by one 0.5, else 0.
-- points = round(f * (quiz_correct_points + quiz_max_speed_bonus * speed)),
-- speed = 1 − elapsed / time_limit on server timestamps (0..1). Only f > 0
-- gets a ledger row. Rest as in 20261107120000 (lock, expiry, idempotency).
-- ---------------------------------------------------------------------------

create or replace function public.close_question()
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
    s.player_id,
    round(s.f * (c.quiz_correct_points + c.quiz_max_speed_bonus * s.speed))::int,
    'quiz',
    s.question_id
  from (
    select
      a.player_id,
      a.question_id,
      greatest(0, least(1,
        1 - extract(epoch from (a.answered_at - v_state.question_opened_at)) / q.time_limit_s
      )) as speed,
      case q.kind
        when 'single' then
          case when exists (
            select 1 from public.quiz_keys k
            where k.question_id = a.question_id and k.correct_option_id = a.option_id
          ) then 1.0 else 0.0 end
        when 'multi' then (
          select greatest(0,
            coalesce(
              count(*) filter (where o.id = any (a.option_ids) and k.correct_option_id is not null)::numeric
                / nullif(count(k.correct_option_id), 0),
              0)
            - coalesce(
              count(*) filter (where o.id = any (a.option_ids) and k.correct_option_id is null)::numeric
                / nullif(count(*) filter (where k.correct_option_id is null), 0),
              0)
          )
          from public.quiz_options o
          left join public.quiz_keys k
            on k.question_id = o.question_id and k.correct_option_id = o.id
          where o.question_id = a.question_id
        )
        when 'number' then (
          select case abs(a.number_value - nk.value) when 0 then 1.0 when 1 then 0.5 else 0.0 end
          from public.quiz_number_keys nk
          where nk.question_id = a.question_id
        )
      end as f
    from public.quiz_answers a
    join public.quiz_questions q on q.id = a.question_id
    where a.question_id = v_state.current_question_id
  ) s
  cross join public.scoring_config c
  where s.f > 0
  on conflict (player_id, source_type, source_id) do nothing;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute permissions: the helper is internal; the new RPCs are for
-- signed-in users, like the rest.
-- ---------------------------------------------------------------------------

revoke execute on function public.assert_can_answer(uuid, text) from public, anon, authenticated;

revoke execute on function
  public.submit_multi_answer(uuid, uuid[]),
  public.submit_number_answer(uuid, int)
from public, anon;

grant execute on function
  public.submit_multi_answer(uuid, uuid[]),
  public.submit_number_answer(uuid, int)
to authenticated;
