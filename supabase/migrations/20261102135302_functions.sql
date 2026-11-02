-- Game RPCs. Clients call these with supabase.rpc(...).
--
-- security definer functions run with the owner's privileges and bypass RLS,
-- so each one checks the caller itself (auth.uid(), is_host()). All of them
-- pin search_path to '' and use fully qualified names, so nobody can shadow
-- a table or function with their own object. Execute is revoked from
-- public/anon at the end of the file.

-- ---------------------------------------------------------------------------
-- server_now(): server clock, used by clients only to display the countdown.
-- Invoker: it touches no data, so it needs no extra privileges.
-- ---------------------------------------------------------------------------

create function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

-- ---------------------------------------------------------------------------
-- join_party(): create or update the caller's player row.
-- Invoker: the RLS policies on players already allow exactly this.
-- ---------------------------------------------------------------------------

create function public.join_party(p_name text, p_emoji text)
returns public.players
language plpgsql
set search_path = ''
as $$
declare
  v_player public.players;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 30 then
    raise exception 'Name must be between 1 and 30 characters';
  end if;

  insert into public.players (id, name, emoji)
  values (auth.uid(), trim(p_name), p_emoji)
  on conflict (id) do update
    set name = excluded.name, emoji = excluded.emoji
  returning * into v_player;

  return v_player;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quiz
-- ---------------------------------------------------------------------------

create function public.submit_answer(p_question_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.party_state;
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

  -- FOR SHARE: answers can run in parallel, but close_question (which updates
  -- this row) waits for them, so no answer slips in after points are computed.
  select * into v_state from public.party_state where id = 1 for share;

  if v_state.current_question_id is distinct from p_question_id
     or v_state.question_status <> 'open' then
    raise exception 'This question is not open';
  end if;

  if now() > v_state.question_closes_at then
    raise exception 'Time is up';
  end if;

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

create function public.open_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state      public.party_state;
  v_time_limit int;
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  select time_limit_s into v_time_limit
  from public.quiz_questions where id = p_question_id;

  if v_time_limit is null then
    raise exception 'Question not found';
  end if;

  select * into v_state from public.party_state where id = 1 for update;

  if v_state.question_status = 'open' then
    raise exception 'Close the current question first';
  end if;

  update public.party_state
  set phase               = 'quiz',
      current_question_id = p_question_id,
      question_status     = 'open',
      question_opened_at  = now(),
      question_closes_at  = now() + make_interval(secs => v_time_limit)
  where id = 1;
end;
$$;

-- Score for a correct answer:
--   quiz_correct_points + round(quiz_max_speed_bonus * (1 - elapsed / time_limit))
-- with elapsed measured on server timestamps. Wrong answers get no ledger row.
-- Idempotent: a second call finds the question already closed and does
-- nothing; the ledger's unique constraint is a second safety net.
create function public.close_question()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.party_state;
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  select * into v_state from public.party_state where id = 1 for update;

  if v_state.question_status <> 'open' then
    return;
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
end;
$$;

create function public.reveal_question()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  select question_status into v_status from public.party_state where id = 1 for update;

  if v_status = 'revealed' then
    return;
  end if;

  if v_status <> 'closed' then
    raise exception 'Close the question before revealing it';
  end if;

  update public.party_state set question_status = 'revealed' where id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Challenges: same points to several players in one call (team challenges).
-- Re-awarding overwrites instead of adding, so mistakes can be fixed.
-- Returns the number of players awarded.
-- ---------------------------------------------------------------------------

create function public.award_challenge_points(
  p_challenge_id uuid,
  p_player_ids   uuid[],
  p_points       int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  if not exists (select 1 from public.challenges where id = p_challenge_id) then
    raise exception 'Challenge not found';
  end if;

  if coalesce(cardinality(p_player_ids), 0) = 0 then
    raise exception 'Select at least one player';
  end if;

  if p_points is null or p_points < 0 then
    raise exception 'Points must be zero or more';
  end if;

  insert into public.points_ledger (player_id, points, source_type, source_id)
  select distinct player_id, p_points, 'challenge', p_challenge_id
  from unnest(p_player_ids) as player_id
  on conflict (player_id, source_type, source_id) do update
    set points = excluded.points, created_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Show
-- ---------------------------------------------------------------------------

-- Creates an act and its members atomically. The caller is always a member.
create function public.sign_up_act(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_members uuid[];
  v_act_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (select 1 from public.players where id = auth.uid()) then
    raise exception 'Join the party first';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'Title must be between 1 and 60 characters';
  end if;

  select array_agg(distinct m) into v_members
  from unnest(coalesce(p_member_ids, '{}') || auth.uid()) as m;

  if exists (
    select 1 from unnest(v_members) as m
    where not exists (select 1 from public.players p where p.id = m)
  ) then
    raise exception 'Unknown player';
  end if;

  insert into public.show_acts (title, created_by, position)
  values (
    trim(p_title),
    auth.uid(),
    (select coalesce(max(position), 0) + 1 from public.show_acts)
  )
  returning id into v_act_id;

  insert into public.show_act_members (act_id, player_id)
  select v_act_id, m from unnest(v_members) as m;

  return v_act_id;
end;
$$;

-- One vote per person per act (1-5). Voting again while the act is open
-- changes the vote. Members of the act cannot vote for it.
create function public.cast_vote(p_act_id uuid, p_score int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (select 1 from public.players where id = auth.uid()) then
    raise exception 'Join the party first';
  end if;

  if p_score is null or p_score not between 1 and 5 then
    raise exception 'Score must be between 1 and 5';
  end if;

  -- FOR SHARE, same reason as submit_answer: close_voting waits for us.
  select status into v_status from public.show_acts where id = p_act_id for share;

  if v_status is null then
    raise exception 'Act not found';
  end if;

  if v_status <> 'voting' then
    raise exception 'Voting is not open for this act';
  end if;

  if exists (
    select 1 from public.show_act_members
    where act_id = p_act_id and player_id = auth.uid()
  ) then
    raise exception 'You cannot vote for your own act';
  end if;

  insert into public.show_votes (act_id, voter_id, score)
  values (p_act_id, auth.uid(), p_score)
  on conflict (act_id, voter_id) do update
    set score = excluded.score, voted_at = now();
end;
$$;

-- Act score = round(avg(score) * show_points_per_star), given to each member.
-- Upsert, so calling it again (e.g. after reopening the vote) recomputes
-- instead of adding.
create function public.close_voting(p_act_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_points int;
begin
  if not public.is_host() then
    raise exception 'Only the host can do this';
  end if;

  select status into v_status from public.show_acts where id = p_act_id for update;

  if v_status is null then
    raise exception 'Act not found';
  end if;

  if v_status not in ('voting', 'done') then
    raise exception 'Voting is not open for this act';
  end if;

  update public.show_acts set status = 'done' where id = p_act_id;

  select round(avg(v.score) * c.show_points_per_star)::int into v_points
  from public.show_votes v
  cross join public.scoring_config c
  where v.act_id = p_act_id
  group by c.show_points_per_star;

  if v_points is null then
    return;
  end if;

  insert into public.points_ledger (player_id, points, source_type, source_id)
  select m.player_id, v_points, 'show', p_act_id
  from public.show_act_members m
  where m.act_id = p_act_id
  on conflict (player_id, source_type, source_id) do update
    set points = excluded.points, created_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute permissions. Postgres grants EXECUTE to PUBLIC by default, so we
-- take it away and give it only to signed-in users (guests included).
-- ---------------------------------------------------------------------------

revoke execute on function
  public.server_now(),
  public.join_party(text, text),
  public.submit_answer(uuid, uuid),
  public.open_question(uuid),
  public.close_question(),
  public.reveal_question(),
  public.award_challenge_points(uuid, uuid[], int),
  public.sign_up_act(text, uuid[]),
  public.cast_vote(uuid, int),
  public.close_voting(uuid),
  public.touch_updated_at()
from public, anon;

grant execute on function
  public.server_now(),
  public.join_party(text, text),
  public.submit_answer(uuid, uuid),
  public.open_question(uuid),
  public.close_question(),
  public.reveal_question(),
  public.award_challenge_points(uuid, uuid[], int),
  public.sign_up_act(text, uuid[]),
  public.cast_vote(uuid, int),
  public.close_voting(uuid)
to authenticated;
