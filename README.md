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
| `npx supabase stop` | Stop the local Supabase stack (data is kept) |
| `npx supabase db reset` | Rebuild the database from `supabase/migrations` and `supabase/seed.sql` |
| `npx supabase migration new <name>` | Create a new migration file |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint with oxlint |
