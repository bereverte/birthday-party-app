-- Core schema: tables, constraints, singleton rows and leaderboard views.
-- Security (RLS, grants) lives in the next migration.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- Everyone who plays, including the host. id = auth.uid(), so an anonymous
-- guest who reopens the tab is recognised by the persisted session.
create table public.players (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 30),
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now()
);

-- Who can control the game. Separate from players: the host has a row in both.
create table public.hosts (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Configuration and game state (singletons)
-- ---------------------------------------------------------------------------

create table public.scoring_config (
  id                   int primary key default 1 check (id = 1),
  quiz_correct_points  int   not null check (quiz_correct_points >= 0),
  quiz_max_speed_bonus int   not null check (quiz_max_speed_bonus >= 0),
  show_points_per_star int   not null check (show_points_per_star >= 0),
  challenge_presets    int[] not null
);

-- ---------------------------------------------------------------------------
-- Quiz
-- ---------------------------------------------------------------------------

create table public.quiz_questions (
  id           uuid primary key default gen_random_uuid(),
  position     int  not null unique,
  text         text not null,
  image_url    text,
  time_limit_s int  not null default 20 check (time_limit_s between 5 and 120)
);

-- No is_correct column on purpose: guests can read options (see quiz_keys).
create table public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  position    int  not null,
  text        text not null,
  unique (question_id, position),
  -- Target for composite foreign keys: guarantees an option belongs to the question.
  unique (id, question_id)
);

create table public.quiz_keys (
  question_id       uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_option_id uuid not null,
  foreign key (correct_option_id, question_id)
    references public.quiz_options (id, question_id) on delete cascade
);

create table public.quiz_answers (
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  option_id   uuid not null,
  answered_at timestamptz not null default now(),
  primary key (question_id, player_id),
  foreign key (option_id, question_id)
    references public.quiz_options (id, question_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Challenges (results go straight to points_ledger)
-- ---------------------------------------------------------------------------

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  position    int  not null unique,
  name        text not null,
  emoji       text not null default '🏆',
  description text,
  status      text not null default 'pending'
              check (status in ('pending', 'active', 'done'))
);

-- ---------------------------------------------------------------------------
-- Final show
-- ---------------------------------------------------------------------------

create table public.show_acts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(trim(title)) between 1 and 60),
  created_by uuid not null references public.players (id) on delete cascade,
  position   int,
  status     text not null default 'pending'
             check (status in ('pending', 'performing', 'voting', 'done')),
  created_at timestamptz not null default now()
);

create table public.show_act_members (
  act_id    uuid not null references public.show_acts (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  primary key (act_id, player_id)
);

create table public.show_votes (
  act_id   uuid not null references public.show_acts (id) on delete cascade,
  voter_id uuid not null references public.players (id) on delete cascade,
  score    int  not null check (score between 1 and 5),
  voted_at timestamptz not null default now(),
  primary key (act_id, voter_id)
);

-- ---------------------------------------------------------------------------
-- Party state machine (singleton)
-- ---------------------------------------------------------------------------

create table public.party_state (
  id                   int primary key default 1 check (id = 1),
  phase                text not null default 'lobby'
                       check (phase in ('lobby', 'quiz', 'challenges', 'show', 'finished')),
  current_question_id  uuid references public.quiz_questions (id) on delete set null,
  question_status      text not null default 'idle'
                       check (question_status in ('idle', 'open', 'closed', 'revealed')),
  question_opened_at   timestamptz,
  question_closes_at   timestamptz,
  current_challenge_id uuid references public.challenges (id) on delete set null,
  current_act_id       uuid references public.show_acts (id) on delete set null,
  updated_at           timestamptz not null default now()
);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger party_state_touch_updated_at
  before update on public.party_state
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Points ledger: every point awarded is one row, never a stored total.
-- ---------------------------------------------------------------------------

create table public.points_ledger (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  points      int  not null,
  source_type text not null check (source_type in ('quiz', 'challenge', 'show')),
  -- quiz_questions.id, challenges.id or show_acts.id depending on source_type.
  source_id   uuid not null,
  created_at  timestamptz not null default now(),
  -- One entry per player per source: makes scoring idempotent.
  unique (player_id, source_type, source_id)
);

create index points_ledger_source_idx on public.points_ledger (source_type, source_id);

-- ---------------------------------------------------------------------------
-- Singleton rows. Here and not in seed.sql because `supabase db push`
-- (production) runs migrations but never the seed.
-- ---------------------------------------------------------------------------

insert into public.scoring_config
  (quiz_correct_points, quiz_max_speed_bonus, show_points_per_star, challenge_presets)
values
  (500, 500, 100, '{100, 50, 25, 10}');

insert into public.party_state default values;

-- ---------------------------------------------------------------------------
-- Leaderboards. security_invoker makes them respect the caller's RLS.
-- ---------------------------------------------------------------------------

create view public.quiz_leaderboard
with (security_invoker = true) as
select
  p.id    as player_id,
  p.name,
  p.emoji,
  coalesce(sum(l.points), 0)::int as total,
  rank() over (order by coalesce(sum(l.points), 0) desc)::int as rank
from public.players p
left join public.points_ledger l
  on l.player_id = p.id and l.source_type = 'quiz'
where not exists (select 1 from public.hosts h where h.user_id = p.id)
group by p.id;

create view public.party_leaderboard
with (security_invoker = true) as
select
  p.id    as player_id,
  p.name,
  p.emoji,
  coalesce(sum(l.points), 0)::int as total,
  rank() over (order by coalesce(sum(l.points), 0) desc)::int as rank
from public.players p
left join public.points_ledger l
  on l.player_id = p.id and l.source_type in ('challenge', 'show')
group by p.id;
