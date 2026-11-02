-- Row Level Security: who can read and write each table directly.
-- Rule of thumb: reads are governed by policies; writes that involve points
-- or server time go through security definer functions (next migration).
--
-- Note: anonymous guests use the `authenticated` role (they have a real user
-- after signInAnonymously). The `anon` role means "no session at all".

-- ---------------------------------------------------------------------------
-- is_host(): security definer so it always reads hosts with owner privileges,
-- whatever policies apply to the caller. Policies call it as
-- (select public.is_host()) so Postgres evaluates it once per query.
-- ---------------------------------------------------------------------------

create function public.is_host()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.hosts where user_id = auth.uid());
$$;

revoke execute on function public.is_host() from public, anon;
grant execute on function public.is_host() to authenticated;

-- ---------------------------------------------------------------------------
-- No access at all without a session.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. With RLS on and no policy, nothing is visible.
-- ---------------------------------------------------------------------------

alter table public.players          enable row level security;
alter table public.hosts            enable row level security;
alter table public.scoring_config   enable row level security;
alter table public.party_state      enable row level security;
alter table public.quiz_questions   enable row level security;
alter table public.quiz_options     enable row level security;
alter table public.quiz_keys        enable row level security;
alter table public.quiz_answers     enable row level security;
alter table public.challenges       enable row level security;
alter table public.show_acts        enable row level security;
alter table public.show_act_members enable row level security;
alter table public.show_votes       enable row level security;
alter table public.points_ledger    enable row level security;

-- ---------------------------------------------------------------------------
-- players: everyone reads; each user writes only their own row (join_party).
-- ---------------------------------------------------------------------------

create policy "players are visible to everyone"
  on public.players for select to authenticated
  using (true);

create policy "users create their own player"
  on public.players for insert to authenticated
  with check (id = (select auth.uid()));

create policy "users update their own player"
  on public.players for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "host removes players"
  on public.players for delete to authenticated
  using ((select public.is_host()));

-- ---------------------------------------------------------------------------
-- hosts: readable (who the host is isn't secret, and quiz_leaderboard needs
-- it to exclude her). Rows are added by hand from Studio.
-- ---------------------------------------------------------------------------

create policy "hosts are visible to everyone"
  on public.hosts for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- scoring_config: everyone reads (UI hints); host edits.
-- ---------------------------------------------------------------------------

create policy "scoring config is visible to everyone"
  on public.scoring_config for select to authenticated
  using (true);

create policy "host edits scoring config"
  on public.scoring_config for update to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

revoke insert, delete on public.scoring_config from authenticated;

-- ---------------------------------------------------------------------------
-- party_state: everyone reads. The host may update only the navigation
-- columns directly; question status and timestamps change only through
-- open/close/reveal_question, which use server time. RLS filters rows, so
-- the column restriction is done with a column-level GRANT.
-- ---------------------------------------------------------------------------

create policy "party state is visible to everyone"
  on public.party_state for select to authenticated
  using (true);

create policy "host updates party state"
  on public.party_state for update to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

revoke insert, update, delete on public.party_state from authenticated;
grant update (phase, current_challenge_id, current_act_id)
  on public.party_state to authenticated;

-- ---------------------------------------------------------------------------
-- Quiz content: guests only see the current question once it has been
-- opened, so nobody can read the questions in advance.
-- ---------------------------------------------------------------------------

create policy "current question is visible once opened"
  on public.quiz_questions for select to authenticated
  using (
    (select public.is_host())
    or id = (
      select current_question_id from public.party_state
      where question_status <> 'idle'
    )
  );

create policy "host manages questions"
  on public.quiz_questions for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

create policy "options of the current question are visible once opened"
  on public.quiz_options for select to authenticated
  using (
    (select public.is_host())
    or question_id = (
      select current_question_id from public.party_state
      where question_status <> 'idle'
    )
  );

create policy "host manages options"
  on public.quiz_options for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

-- The correct answer: host always, guests only after the reveal.
create policy "key is visible to host or after reveal"
  on public.quiz_keys for select to authenticated
  using (
    (select public.is_host())
    or question_id = (
      select current_question_id from public.party_state
      where question_status = 'revealed'
    )
  );

create policy "host manages keys"
  on public.quiz_keys for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

-- Answers: own answer, or all of them for the host (answer counter).
-- No write policies: answers are only inserted by submit_answer.
create policy "own answers or host sees all"
  on public.quiz_answers for select to authenticated
  using (player_id = (select auth.uid()) or (select public.is_host()));

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------

create policy "challenges are visible to everyone"
  on public.challenges for select to authenticated
  using (true);

create policy "host manages challenges"
  on public.challenges for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

-- ---------------------------------------------------------------------------
-- Show: everyone sees acts and members. Guests sign up via sign_up_act;
-- the host moves acts between statuses and can fix sign-ups.
-- ---------------------------------------------------------------------------

create policy "acts are visible to everyone"
  on public.show_acts for select to authenticated
  using (true);

create policy "host manages acts"
  on public.show_acts for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

create policy "act members are visible to everyone"
  on public.show_act_members for select to authenticated
  using (true);

create policy "host manages act members"
  on public.show_act_members for all to authenticated
  using ((select public.is_host()))
  with check ((select public.is_host()));

-- Votes: own vote, or all for the host. Written only by cast_vote.
create policy "own votes or host sees all"
  on public.show_votes for select to authenticated
  using (voter_id = (select auth.uid()) or (select public.is_host()));

-- ---------------------------------------------------------------------------
-- points_ledger: everyone reads (leaderboards). Points are only written by
-- the scoring functions; the host may delete a row to fix a mistake.
-- ---------------------------------------------------------------------------

create policy "points are visible to everyone"
  on public.points_ledger for select to authenticated
  using (true);

create policy "host removes points"
  on public.points_ledger for delete to authenticated
  using ((select public.is_host()));
