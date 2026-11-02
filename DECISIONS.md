# Decisions

A log of significant technical decisions and the reasoning behind them.

---

## 001 — Database is the single source of truth; Realtime is a doorbell

**Decision:** All game state lives in Postgres. Realtime events only tell clients "something changed"; clients then refetch from the database. Clients also refetch on every (re)subscribe and when the tab becomes visible again.

**Why:** Guests use mobile data, so connections drop often (locked screens, weak coverage). If a client misses a message, the next refetch fixes it. No client ever depends on having received every event.

## 002 — `party_state` singleton as the game's state machine

**Decision:** A single-row table (`id = 1`) holds the current phase (`lobby`, `quiz`, `challenges`, `show`, `finished`), the current question and its status (`idle`, `open`, `closed`, `revealed`), server timestamps for when it opened/closes, and the current challenge/act.

**Why:** Any client, including one that just reconnected, reads one row and knows exactly what to render. There is only one party, so no `parties` table.

## 003 — One points ledger, two leaderboards as views

**Decision:** Every point awarded is a row in `points_ledger` (`player_id`, `points`, `source_type`, `source_id`). There is no stored total. Two views compute the rankings:
- `quiz_leaderboard`: `source_type = 'quiz'`, guests only.
- `party_leaderboard`: `source_type IN ('challenge', 'show')`, includes the host.

**Why:** Like a bank statement: every movement is traceable and totals can never drift out of sync. A new ranking is just a new view. A `unique(player_id, source_type, source_id)` constraint makes scoring idempotent: closing a question twice doesn't double points, and re-awarding a challenge overwrites instead of adding.

## 004 — Host is both an admin and a player

**Decision:** The host has a row in `hosts` (permissions) and in `players` (participation). She plays challenges and the show but not the quiz (the quiz is about her). `submit_answer` rejects hosts, and `quiz_leaderboard` excludes them. Whether she is eligible for a prize is deferred.

**Why:** Separating "who can control the game" from "who plays" keeps both concepts simple and lets RLS check `is_host()` independently.

## 005 — Correct answers stored in a separate table

**Decision:** `quiz_options` has no `is_correct` column. The correct option lives in `quiz_keys`, readable only by the host, or by everyone once the question is `revealed`.

**Why:** Guests can read `quiz_options`. If the answer were in the same row, anyone could see it in DevTools. RLS works per row, not per column, so a separate table is the clean way to hide it.

## 006 — Scoring logic in SQL functions with server timestamps

**Decision:** Clients call `security definer` RPCs (`submit_answer`, `close_question`, `award_challenge_points`, `cast_vote`, `close_voting`, ...) instead of writing to sensitive tables. `answered_at` defaults to `now()` on the server. Quiz score for a correct answer = `quiz_correct_points + round(quiz_max_speed_bonus * (1 - elapsed / time_limit))`.

**Why:** Client clocks and client-sent data can't be trusted. The client only uses `server_now()` to compute a clock offset for displaying the countdown.

**Who closes a question:** the host's device calls `close_question()` when the timer ends (or via "close now"). No cron needed: `submit_answer` already rejects late answers, so a delayed close can't let anyone cheat.

## 007 — Scoring constants in a `scoring_config` table

**Decision:** Point values (`quiz_correct_points`, `quiz_max_speed_bonus`, `show_points_per_star`, `challenge_presets`) live in a single-row table, seeded in `seed.sql`.

**Why:** Scoring runs in SQL, so constants must be in the database. One place to change them, editable from Supabase Studio without redeploying. The frontend reads the same values for UI hints.

## 008 — Team challenges: one call, many players

**Decision:** `award_challenge_points(challenge_id, player_ids uuid[], points int)` gives the same points to several players at once. The host UI multi-selects players and taps a preset.

**Why:** Team challenges are common and the host is busy during the party; one action per team is faster and less error-prone than one per person.

## 009 — Show: no self-voting, enforced in the database

**Decision:** `show_act_members` (many-to-many) links acts to players. `cast_vote` rejects voters who are members of the act. `show_votes` has primary key `(act_id, voter_id)`, so one vote per person per act. Act score = average (1–5) × `show_points_per_star`, given to each member.

**Why:** Rules enforced in the database can't be bypassed by a modified client.

## 010 — Realtime: which tool for what

| Tool | Used for |
|---|---|
| Postgres Changes | `party_state` (everyone), `quiz_answers` (host's answer counter), show sign-ups, `points_ledger` (triggers leaderboard refetch) |
| Broadcast | Host "force resync" command; optional live reactions |
| Presence | Who is online (lobby, host panel) |

**Why:** Persistent data → Postgres Changes. Ephemeral messages → Broadcast (lighter, no DB write). "Who's here now" → Presence (handles disconnects automatically). At ~30 users, the per-subscriber RLS cost of Postgres Changes is negligible.

## 011 — Anonymous sign-in rate limit raised for mobile data

**Decision:** Raise the anonymous sign-in limit from the default 30/hour/IP to ~300/hour.
- Local: `supabase/config.toml` → `[auth.rate_limit] anonymous_users`.
- Production: Dashboard → Authentication → Rate Limits (not `config push`, which can overwrite other remote auth settings).

**Why:** Mobile carriers often use CGNAT, so many guests can share one public IP. Reconnects don't consume sign-ins (the session persists in the browser), but the initial join could hit the limit if many guests arrive at once.

## 012 — Local Supabase with Docker

**Decision:** Develop against a local Supabase stack (`supabase start`, running in Docker Desktop). Schema lives in `supabase/migrations/`, data in `seed.sql`. Production gets the same migrations via `supabase db push`.

**Why:** Free, fast, offline, and the database is reproducible from git (`supabase db reset`). Magic-link emails land in local Mailpit, avoiding hosted email rate limits during development.

## 013 — Feature-based folder structure

**Decision:** `src/features/<feature>/` (join, quiz, challenges, show, leaderboard), shared `hooks/`, `lib/`, `components/ui/`. Pages are thin and only choose which feature to render based on `party_state.phase`.

**Why:** Everything about one feature lives together, which makes it easy to find and change during a tight deadline.

## 016 — Singleton rows live in a migration, not in the seed

**Decision:** The `scoring_config` and `party_state` rows (`id = 1`) are inserted by the schema migration. `seed.sql` only holds sample content (questions, challenges).

**Why:** `supabase db push` applies migrations to production but never runs `seed.sql`. Without those rows the app wouldn't start in production. Composite foreign keys (`(option_id, question_id) → quiz_options`) also guarantee in the schema itself that an answer or a key always points to an option of the same question.
