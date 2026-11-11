-- Written-answer questions and reveal images (DECISIONS 032).
--   text: the guest types an answer. It's compared normalized (lower case,
--         no accents, only letters and digits) against a per-question list:
--         some answers are worth 100 %, others 50 % (e.g. "Nuc" vs "Nuk"),
--         anything else 0 %. The host picks the half-credit spellings by
--         hand instead of a fuzzy rule: with a 3-letter answer, "one typo
--         away" would also accept a different name ("Luc").
--   reveal image: a picture shown only at the reveal (e.g. a photo of the
--         answer), for any kind. quiz_questions.image_url is visible while
--         the question is open, so it can't hold a spoiler.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.quiz_questions
  drop constraint quiz_questions_kind_check,
  add constraint quiz_questions_kind_check
    check (kind in ('single', 'multi', 'number', 'text'));

-- Accepted answers. credit 1 = full points, 0.5 = half. The first full
-- answer (lowest position) is the one shown at the reveal.
create table public.quiz_text_keys (
  question_id uuid    not null references public.quiz_questions (id) on delete cascade,
  position    int     not null,
  answer      text    not null check (char_length(answer) between 1 and 60),
  credit      numeric not null default 1 check (credit in (0.5, 1)),
  primary key (question_id, position)
);

create table public.quiz_reveal_images (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  image_url   text not null
);

alter table public.quiz_answers
  add column text_value text check (char_length(text_value) between 1 and 60),
  drop constraint quiz_answers_one_value_check,
  add constraint quiz_answers_one_value_check
    check (num_nonnulls(option_id, option_ids, number_value, text_value) = 1);

-- ---------------------------------------------------------------------------
-- RLS: both new tables are spoilers, same rules as quiz_keys.
-- ---------------------------------------------------------------------------

alter table public.quiz_text_keys     enable row level security;
alter table public.quiz_reveal_images enable row level security;

create policy "text keys are visible to host or after reveal"
  on public.quiz_text_keys for select to authenticated
  using (
    (select public.is_host())
    or question_id = (
      select current_question_id from public.party_state
      where question_status = 'revealed'
    )
  );

create policy "host manages text keys"
  on public.quiz_text_keys for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

create policy "reveal images are visible to host or after reveal"
  on public.quiz_reveal_images for select to authenticated
  using (
    (select public.is_host())
    or question_id = (
      select current_question_id from public.party_state
      where question_status = 'revealed'
    )
  );

create policy "host manages reveal images"
  on public.quiz_reveal_images for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

-- ---------------------------------------------------------------------------
-- Normalizing and answering
-- ---------------------------------------------------------------------------

-- " Nuc. " → "nuc", "Pérez" → "perez", "l'Anna" → "lanna".
-- The frontend has a copy for the reveal message (display only).
create function public.normalize_answer(p_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(p_text, ''))), '[^a-z0-9]', '', 'g');
$$;

create function public.submit_text_answer(p_question_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := btrim(p_text);
begin
  perform public.assert_can_answer(p_question_id, 'text');

  if public.normalize_answer(v_text) = '' then
    raise exception 'Write an answer';
  end if;

  if char_length(v_text) > 60 then
    raise exception 'Answer too long';
  end if;

  insert into public.quiz_answers (question_id, player_id, text_value)
  values (p_question_id, auth.uid(), v_text)
  on conflict do nothing;

  if not found then
    raise exception 'You already answered this question';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scoring: as in 20261109120000, plus text = the best credit among the
-- accepted answers that match after normalizing (0 if none).
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
          select case
            when bool_or(o.id = any (a.option_ids) and k.correct_option_id is null) then 0.0
            else coalesce(
              count(*) filter (where o.id = any (a.option_ids) and k.correct_option_id is not null)::numeric
                / nullif(count(k.correct_option_id), 0),
              0)
          end
          from public.quiz_options o
          left join public.quiz_keys k
            on k.question_id = o.question_id and k.correct_option_id = o.id
          where o.question_id = a.question_id
        )
        when 'number' then (
          select case
            when a.number_value = nk.value then 1.0
            when abs(a.number_value - nk.value) <= q.number_tolerance then 0.5
            else 0.0
          end
          from public.quiz_number_keys nk
          where nk.question_id = a.question_id
        )
        when 'text' then (
          select coalesce(max(tk.credit), 0.0)
          from public.quiz_text_keys tk
          where tk.question_id = a.question_id
            and public.normalize_answer(tk.answer) = public.normalize_answer(a.text_value)
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
-- Execute permissions
-- ---------------------------------------------------------------------------

revoke execute on function public.normalize_answer(text) from public, anon;
grant execute on function public.normalize_answer(text) to authenticated;

revoke execute on function public.submit_text_answer(uuid, text) from public, anon;
grant execute on function public.submit_text_answer(uuid, text) to authenticated;
