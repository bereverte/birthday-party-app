# Birthday Party App 🎉

A realtime party game for ~30 guests: a Kahoot-style quiz about the host, party challenges and a final show with voting. Guests join by scanning a QR code with their phone.

**Stack:** React + TypeScript + Tailwind (Vite), Supabase (Postgres, Realtime, Auth), Vercel.

Architecture decisions and their reasoning are in [DECISIONS.md](DECISIONS.md).

## Requirements

- Node.js 20+
- Docker Desktop (runs the local Supabase stack)

## Getting started

1. Open Docker Desktop and wait until it says the engine is running.
2. Install dependencies and start Supabase:
   ```sh
   npm install
   npx supabase start
   ```
3. Create `.env.local` from `.env.example`. Get the values from:
   ```sh
   npx supabase status
   ```
   Use `API_URL` for `VITE_SUPABASE_URL` and `PUBLISHABLE_KEY` for `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Start the app:
   ```sh
   npm run dev
   ```

## Local URLs

| What | URL |
|---|---|
| App (guest) | http://localhost:5173 |
| App (host) | http://localhost:5173/host |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit (magic-link emails) | http://127.0.0.1:54324 |

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev:mobile` | Dev server reachable from a phone on the same Wi-Fi (see below) |
| `npx supabase stop` | Stop the local Supabase stack (data is kept) |
| `npx supabase db reset` | Rebuild the database from `supabase/migrations` and `supabase/seed.sql` |
| `npx supabase migration new <name>` | Create a new migration file |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` after a migration |
| `npm run db:test` | Run the database tests in `supabase/tests` (pgTAP) |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint with oxlint |

## Testing locally as guest and host

`/` and `/host` share the same session within a browser, so use two browsers (or a normal window and an incognito one): one as a guest, one as the host. Several incognito windows of the same browser share one session too; use different browsers or profiles for several guests.

## Testing on a real phone

On the phone, `localhost` means the phone itself, so the app must talk to the laptop's Wi-Fi IP instead.

1. Connect the laptop and the phone to the same Wi-Fi.
2. Find the laptop's IP: run `ipconfig` and look for the **IPv4 Address** of the Wi-Fi adapter (e.g. `192.168.1.136`). It can change between days, so check it again if the phone stops connecting.
3. Create `.env.mobile.local` (git-ignored) with that IP and the same key as `.env.local`:
   ```
   VITE_SUPABASE_URL=http://192.168.1.136:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<same as .env.local>
   ```
4. Run:
   ```sh
   npm run dev:mobile
   ```
   This is `vite --host --mode mobile`: `--host` exposes the dev server on the network, and `--mode mobile` makes Vite load `.env.mobile.local` on top of `.env.local`. `npm run dev` keeps working as before.
5. On the phone, open `http://192.168.1.136:5173`.

If the phone can't load the page or gets stuck connecting:
- The Wi-Fi network must be set as **Private** in Windows (Settings → Network → Wi-Fi → network properties).
- Windows Firewall must allow Node.js (port 5173) and Docker Desktop (port 54321) on private networks. Windows usually asks the first time; if it was denied, allow them in "Allow an app through Windows Firewall".

**Limitation: the host's magic link.** The link in the email points at the local Auth URL (`127.0.0.1:54321`), which doesn't work from the phone. Locally, test guests on the phone and the host on the laptop (use DevTools' device mode for the host's phone layout). The host's real phone login is tested against the cloud project.

## Making a user the host

The host signs in with a magic link (emails land in Mailpit locally) and joins the party like any player. Then, in Supabase Studio → SQL Editor:

```sql
insert into public.hosts (user_id)
select id from auth.users where email = '<host email>';
```

Locally there's a shortcut: `npm run db:host` makes the most recent magic-link user the host. It's needed again after every `db reset`, because the reset deletes the users. Then sign out and back in on `/host`, and use fresh private windows for guests, because old sessions point at users that no longer exist.

In production, run the same query from the Supabase dashboard SQL Editor.

## Loading the quiz questions

Locally, `seed.sql` loads three sample questions. Production has no seed, so the real questions are loaded by hand:

1. Copy `supabase/quiz-content.example.sql` to `supabase/quiz-content.sql`. That file is git-ignored: the repo is public and must not contain the real answers.
2. Write the questions in the JSON list. Every question has `text`, and optionally `time` (seconds, default 20) and `image` (a URL). The rest depends on `type`:
   - `single` (default): `options` (2 to 6) and `correct`, one letter (`"A"`).
   - `multi`: `options` and `correct`, a list of letters (`["A", "C"]`). Any wrong mark scores 0.
   - `number`: `max` (10 or less works best with the − / + buttons), `answer`, and optionally `close`: answers that far off or closer get half points (default 0, exact only).
   - `text`: `answers`, a list of spellings worth full points (the first is shown at the reveal), and optionally `close`, a list worth half. They're compared in lower case, without accents, spaces or punctuation.

   Any question can also have `reveal_image`, a URL shown only at the reveal (for a photo that would give the answer away).
3. Paste the whole file into the Supabase dashboard → SQL Editor and run it. It replaces every question and prints `Loaded N questions`.

The script refuses to run once anyone has answered, so it can't wipe a quiz in progress. Load the questions before the party, and test them with a run-through. After a test run, delete the test players' answers and points first.

## Challenges

Challenges are created from `/host` (phase "🏃 Proves" → "+ Nova"), locally and in production; `seed.sql` adds two samples locally. During the party: start a challenge, tap the players who won (or a whole team), then tap the points. Tapping again overwrites; "Treure punts" removes them. A challenge with points can't be deleted until its points are removed. The point buttons come from `scoring_config.challenge_presets` (default 100, 50, 25, 10).

## Show

Guests sign up from the floating "🎤 Apunta't al show" button (any phase except while a quiz question is open): a title and, optionally, partners. They can withdraw it until it goes on stage. The host can sign up her own act from `/host` too. During the party, in phase "🎤 Show": ▶️ start an act → 🗳️ open voting (everyone except the act's members votes 1–5 stars, the host included) → ✅ close voting, which gives each member avg × `scoring_config.show_points_per_star` (default 100). A closed act can be started again to redo it. An act with points can't be deleted.

## Deploy

Production: <https://birthday-party-app-brown.vercel.app>

- **Frontend:** Vercel, connected to the GitHub repo. Every push to `main` deploys. `vercel.json` rewrites all routes to `index.html` (client-side routing). Environment variables in Vercel: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Database:** apply new migrations to the cloud project (never the seed):

  ```bash
  npx supabase link --project-ref <project ref>   # once
  npx supabase db push --remote --dry-run          # check what will run
  npx supabase db push --remote
  ```

  Without `--remote`, `db push` targets the local stack.
- **Auth (dashboard, set once):** anonymous sign-ins on; anonymous rate limit 300/hour; Site URL = the Vercel URL; Redirect URLs include `<vercel url>/host`. Don't use `supabase config push`: `config.toml` holds the local URLs.
- The free plan pauses a project after 7 days without activity.
