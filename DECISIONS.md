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
| Postgres Changes | `party_state` (everyone), `players` (lobby: who has joined), `quiz_answers` (host's answer counter), show sign-ups, `points_ledger` (triggers leaderboard refetch) |
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

## 014 — Reads through RLS, sensitive writes through RPCs

**Decision:** RLS is enabled on every table. Policies decide who can **read** each row (mostly "everyone signed in", with exceptions for answers, votes and quiz content). Direct **writes** are allowed only where they are harmless: a user's own `players` row, and host-only content tables. Anything involving points or server time (`quiz_answers`, `show_votes`, `points_ledger`, question status) has no write policy and is only written by functions. All privileges are revoked from the `anon` role.

**Why:** The browser talks to Postgres through a public API key, so anyone can send arbitrary queries from DevTools. RLS is a filter Postgres adds to every query, row by row. Anonymous guests use the `authenticated` role (they get a real user after `signInAnonymously`); `anon` means "no session", so it gets nothing.

**Column-level limits:** RLS filters rows, not columns. On `party_state` the host can update `phase`, `current_challenge_id` and `current_act_id` directly (column-level `GRANT UPDATE`), but question status and timestamps only change through `open/close/reveal_question`, which use server time.

## 017 — Quiz questions hidden until they are opened

**Decision:** Guests can only read the current question (and its options) once its status is no longer `idle`. The correct answer (`quiz_keys`) is visible to guests only when the current question is `revealed`. The host sees everything.

**Why:** Otherwise any guest could read all questions in advance from DevTools and get the speed bonus. Policies compare against `party_state.current_question_id`, so the visibility follows the game automatically.

## 015 — How security definer functions are protected

**Decision:** Functions that write points, answers or votes are `security definer`. Each one:
1. Checks the caller itself (`auth.uid()`, `is_host()`), because definer functions bypass RLS.
2. Sets `search_path = ''` and uses fully qualified names (`public.players`), so nobody can shadow a table or function with an object in another schema and get it run with owner privileges.
3. Has `EXECUTE` revoked from `public` and `anon` (Postgres grants it to everyone by default) and granted to `authenticated`.

`server_now()` and `join_party()` are plain `security invoker`: the first reads no data, and the second only does what the `players` RLS policies already allow. Rule: definer only when the caller must do something they couldn't do directly, in a controlled way.

**Race between answering and closing:** `submit_answer` reads `party_state` with `FOR SHARE` and `close_question` with `FOR UPDATE`. Answers can run in parallel with each other, but closing waits for in-flight answers to commit, and an answer arriving after the close sees `closed`. So no answer can be stored after its points were computed. `cast_vote` / `close_voting` use the same pattern on `show_acts`.

**Sign-up:** `sign_up_act(title, member_ids)` was added: it creates the act and its members atomically and always includes the caller as a member.

## 018 — Database tests with pgTAP

**Decision:** The key rules are tested in SQL with pgTAP (`supabase/tests/database/*.test.sql`, run with `npm run db:test`). Each file runs inside a transaction that is rolled back. To act as a user, a test switches to the `authenticated` role and sets `request.jwt.claims`, which is exactly what Supabase does on every API request, so `auth.uid()`, RLS and the RPCs behave as in production.

**What is covered:** late answers rejected, host can't answer the quiz, double answers rejected, `close_question` twice doesn't duplicate points, the score formula (5 s out of 20 s → 875), `award_challenge_points` with 3 players creates 3 rows and re-awarding overwrites, no self-voting (creator and partner), vote replacement, show score, and RLS (anon gets nothing, questions hidden until opened, answers hidden until revealed, no direct writes to the ledger, column grant on `party_state`).

**Why:** The rules live in the database, so that's where they are tested, without a browser or a UI. `now()` is frozen inside a transaction, so tests set timestamps explicitly instead of waiting.

## 019 — The refetch pattern in the frontend

**Decision:** One reusable hook, `useRealtimeRefetch({ name, tables, fetcher })`, implements DECISIONS 001. It reads the data immediately, subscribes to Postgres Changes on the given tables, and reads again when:
- an event arrives (the doorbell),
- the channel reaches `SUBSCRIBED` (first connection **and** every reconnection),
- the tab becomes visible again,
- the browser fires `online`,
- the host sends "resync".

Reads are **coalesced**: only one runs at a time, and events that arrive during a read mark the data as dirty, so exactly one more read runs afterwards. 30 guests joining in a burst cause 2 reads, not 30, and an older response can never overwrite a newer one. Each hook instance gets a unique channel topic.

**Why:** Phones lock their screens and switch networks, so events get lost. The client never relies on receiving every event: any of the triggers above fixes its state. Event payloads aren't used at all, which also means RLS-filtered or out-of-order events can't cause bugs. Unique topics are needed because `supabase.channel(topic)` returns an existing channel with the same topic and `removeChannel` is async: with React StrictMode remounting effects, a shared topic would hand back a channel that is being closed.

## 020 — Presence for "who is online"

**Decision:** "Who has joined" comes from the `players` table (Postgres Changes). "Who is online right now" comes from Realtime Presence on a shared `party` channel. Each device tracks `{ user_id }`; the online set is the unique user ids in the presence state, so several tabs of one person count once.

**Why:** Being online is ephemeral state, not data. A `last_seen` column would need a heartbeat writing to the database every few seconds and a rule for when someone counts as gone, and a phone that dies would keep looking online. Presence is handled by the Realtime server: when a socket drops, the server removes that entry and notifies everyone. The user id is in the payload, not the presence key, so the channel doesn't depend on who is signed in and never needs recreating (the host goes from anonymous to signed in on the same page). Presence is tracked again on every `SUBSCRIBED`, because it is lost when the socket drops.

## 021 — Anonymous session and reconnection

**Decision:** The guest page reuses the stored session if there is one and only calls `signInAnonymously()` when there isn't. If it fails (rate limit, no coverage) the guest sees a friendly message and a retry button. The players list doubles as "who am I": if the current user isn't in it, the join form is shown.

**Why:** supabase-js stores the access and refresh tokens in `localStorage` and refreshes them automatically. Reopening the tab gives the same `auth.uid()`, and since `players.id = auth.uid()` the guest lands straight in the lobby without spending another sign-in against the rate limit (DECISIONS 011). The session is only lost if the guest clears site data or switches browser; they then join as a new player and the host can remove the duplicate (DECISIONS 024). Because "who am I" is derived from the live players list, a removed guest automatically falls back to the join form.

## 022 — Force resync over a public Broadcast channel

**Decision:** The host's "force resync" button sends a Broadcast `resync` message on the shared `party` channel. Every `useRealtimeRefetch` listens for it and refetches. The host refetches her own data directly, because Broadcast isn't echoed to the sender by default.

**Why:** It's a rescue button for a phone that looks stuck, and the message carries no data: it only triggers a normal database read through RLS. So the channel can be public: anyone sending `resync` would only make clients read what they're already allowed to read. A private channel with Realtime Authorization would add policies for no security gain.

## 023 — Visual direction and self-hosted font

**Decision:** A "paper party / stickers" look: cream background with a faint confetti tile, saturated colours, thick dark outlines and hard offset shadows; buttons sink into their shadow when pressed. Display font Bricolage Grotesque, self-hosted with `@fontsource-variable` (weight axis only, 41 kB). Design tokens live in Tailwind v4's `@theme` in `index.css`; base components in `src/components/ui/`. UI copy is in Catalan.

**Why:** The brief asked for something festive that doesn't look like a template. The look is built from a few tokens (colours, `shadow-sticker`, `border-3`), so new screens get it for free. Self-hosting avoids depending on Google Fonts over mobile data; the full variable font with the width axis was 131 kB, so only the weight axis is loaded. Animations respect `prefers-reduced-motion`.

## 024 — Players can only be removed if they have no activity

**Decision:** The `players` delete policy is now `is_host() and not player_has_activity(id)`. `player_has_activity` is a `security definer` function that checks the ledger, quiz answers, votes, act memberships and acts created. In the UI, a refused delete returns 0 rows (not an error) and the host sees "already has activity".

**Why:** Every foreign key to `players` is `on delete cascade`. Removing an active player would silently delete their points, answers and votes (changing act averages), and even the acts they created, along with the other members. Their teammates' points for that act would stay orphaned in the ledger, because `source_id` isn't a foreign key. The remove button is meant for duplicates, which have no activity. The rule lives in the database like the others. The helper is definer so it sees every row regardless of the caller's RLS.

## 025 — Deploy before building the game features

**Decision:** Deploy in phase 4, before the quiz. The frontend is on Vercel (`https://birthday-party-app-brown.vercel.app`), connected to the GitHub repo, so every push to `main` deploys to production. The two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are set by hand in Vercel. The Vercel–Supabase marketplace integration is not used.

**Why:** Local Docker can't reproduce what matters on the party day: HTTPS, phones on mobile data, the real magic link email and the real Realtime server. Deploying early means every later feature gets tested in those conditions for free, not in a rush the day before. The integration would create variables with Next.js names (`NEXT_PUBLIC_*`) that a Vite app doesn't read, and could create a second Supabase project. Two variables by hand are clearer.

## 026 — Cloud schema from migrations, cloud Auth config by hand

**Decision:** The cloud database is built with `supabase link` + `supabase db push --remote`, which applies `supabase/migrations/` and records them in the migration history. `seed.sql` is not pushed. The cloud Auth settings are set by hand in the dashboard, not with `supabase config push`: anonymous sign-ins on, sign-ups on, anonymous rate limit 300/hour/IP (DECISIONS 011), Site URL set to the Vercel URL and `<vercel url>/host` added to the redirect URLs. The host row is inserted from the dashboard SQL Editor after her first login.

**Why:** Migrations make the cloud schema identical to the one the pgTAP tests run against, and later phases only push their new migrations. The seed is sample data for development; real quiz content will be entered separately. `config.toml` describes the local stack (localhost URLs), so `config push` would overwrite the production redirect URLs and break the magic link. There are only a few Auth settings, and they're set once. The redirect allow-list is a security feature: Supabase only redirects the magic link to URLs on it. Without custom SMTP, Supabase sends about 2 auth emails per hour, which is enough for one host.

## 027 — Data API settings: keep default table grants

**Decision:** When creating the cloud project: Data API on, "Automatically expose new tables" on, "Enable automatic RLS" off.

**Why:** supabase-js talks to the database through the Data API. The RLS migration revokes table privileges from `anon` but relies on the default grants for `authenticated` (guests and the host). Without default grants, every query would fail with "permission denied". Access is still controlled by RLS, which the migrations enable explicitly on every table, so the automatic RLS trigger would add nothing and the cloud would differ from the local stack.

## 028 — SPA rewrite on Vercel

**Decision:** `vercel.json` rewrites every path to `/index.html`.

**Why:** React Router handles routes in the browser. Without the rewrite, loading `/host` directly (which is where the magic link lands) or reloading any page other than `/` returns a 404 from Vercel, because there is no `host.html`. Built files like `/assets/*.js` are still served, because Vercel checks the file system before applying rewrites.

## 029 — Visual direction v2: "soft" (replaces 023's look)

**Decision:** Replace the sticker look with a softer one: pastel gradient background, white surfaces with diffuse shadows, no outlines, no tilted cards or wiggling emoji. Vivid colours are kept for actions and (later) quiz answers; pastel `*-soft` tokens fill avatars and tinted cards. Primary buttons are dark pills, and the one loud element per screen is the "party" card (pink-to-coral gradient). Bricolage Grotesque stays for headings at weight 700; body text moves to Manrope, also self-hosted with `@fontsource-variable` (the browser only downloads the Latin subset, 25 kB). Done as phase 4.5, before the quiz, so new screens are built in the final style.

**Why:** The sticker look felt too childish for an adult party. Four directions were mocked up on the same three screens (join, lobby, quiz) and compared before touching the code. Because the look lived in `@theme` tokens and the `src/components/ui/` components, the change was mostly in those two places: screens only lost a few one-off classes (tilts, outlines). `Card` lost its `tilt` prop rather than keeping an option the design no longer uses. The gradient isn't `background-attachment: fixed`, because mobile browsers handle that inconsistently.

## 030 — Any player can close an expired question

**Decision:** `close_question()` can be called by any player once `question_closes_at` has passed (the host can still close at any time). When the countdown reaches 0, every phone calls it. It returns `boolean`: `true` when the question is closed (by this call or an earlier one), `false` when a guest calls too early. The client retries silently every second until `party_state` says `closed`.

**Why:** Before, only the host's device closed the question, so a locked or sleeping host phone left everyone waiting on a question that had already timed out. Now any connected guest can close it. Thirty calls at the same moment are safe: `select … for update` on `party_state` makes them wait their turn, the first one closes the question and scores it, and the rest see `closed` and return straight away. The ledger's unique key also stops duplicate points. The expiry check runs after the lock, on the locked row, so the time it reads is the real one. Calling too early (a phone clock a bit ahead, even after the `serverNow()` offset correction) is normal and not an error. Returning `false` instead of raising keeps it out of the UI and the logs. No answer can slip in late either way: `submit_answer` rejects answers after `question_closes_at` by itself.
