# Birthday Party App

Web app for a birthday party on November 15, 2026 (~30 guests). Must be ready a few days before.
Personal project + portfolio piece. The developer wants to learn Supabase and realtime.

## Features

1. Kahoot-style quiz about the host: points for correct answers + speed bonus, ranking after each question, winner at the end.
2. Party challenges (e.g. jump rope, egg-and-spoon race): host enters results, guests earn points.
3. Final show: optional sign-up (solo, pair or group), guests and host vote on each act. No self-voting.
4. Two rankings, each with its own prize: Quiz (guests only) and Party (challenges + show, host included). No global ranking.

## Stack

React + TypeScript + Tailwind (Vite), Supabase (Postgres + Realtime + Auth), deploy on Vercel.

## Key decisions (already agreed)

- Guests join via QR, enter name + emoji. Supabase anonymous auth so they can reconnect after closing the tab.
- Host uses real auth (magic link) so she can control the game from any device.
- The database is the single source of truth. Realtime only notifies changes; on (re)connect, clients refetch state.
- Scoring is server-side (SQL functions), using server timestamps. Never trust client clocks.
- Points go to a single points ledger table; each ranking is a view summing it by source_type. The host plays challenges and the show, not the quiz.
- Guest phones always show the full question, so a projector is optional. Host view (/host) must work on laptop or phone.
- Minimal host rescue controls: force resync, close question now.
- Mobile-first, festive design with personality, not template-looking. Soft style: white cards with diffuse shadows, no outlines or tilts, one loud "party" card per screen at most.

## Status

- Phase 1 (done): Vite + React + TS + Tailwind v4 + React Router, local Supabase in Docker.
- Phase 2 (done): full data model in `supabase/migrations/` (schema, RLS, RPCs, realtime), `seed.sql`, generated types, pgTAP tests.
- Phase 3 (done): shared realtime infrastructure, guest join + lobby, host login + minimal panel, design system.
- Phase 4 (done): deploy. Production: https://birthday-party-app-brown.vercel.app (Vercel auto-deploys `main`). Cloud Supabase project ref `aljqfmjoapqmogvbwsne`, schema from migrations, no seed. See README "Deploy".
- Phase 4.5 (done): visual redesign to the "soft" look (DECISIONS 029).
- Next: quiz, then challenges, show, leaderboards.
- Extra if time allows: avatar builder (e.g. DiceBear) to replace the emoji picker.

## Reuse before writing new code

- `useRealtimeRefetch` (`src/hooks/`): the only way to read live data. Pass `name`, `tables` and a `fetcher`. It refetches on events, on (re)subscribe, when the tab becomes visible, on `online` and on host resync. Don't read event payloads.
- `usePartyState`, `usePlayers`, `usePresence`, `useSession` (`src/hooks/`).
- `src/lib/partyChannel.ts`: the single shared `party` channel for Presence and the `resync` Broadcast. Don't create other channels with a shared topic.
- `src/lib/serverClock.ts`: `serverNow()` / `parseServerTime()` for countdowns (display only).
- `src/lib/errors.ts`: `friendlyError()` turns errors into Catalan UI messages.
- `src/components/ui/`: Button, Card, Screen, TextInput, EmojiAvatar, StatusPill, LoadingScreen, ErrorScreen. Design tokens are in `src/index.css` (`@theme`).
- Pages (`src/pages/`) stay thin and pick a feature from `party_state.phase`. Feature code goes in `src/features/<feature>/`.

## Gotchas

- `supabase.channel(topic)` returns an existing channel with that topic, and `removeChannel` is async. Per-component channels need a unique topic, or a StrictMode remount gets a closing channel.
- Don't use `crypto.randomUUID()` in the frontend: it doesn't exist on insecure origins (a phone testing over `http://192.168…`).
- Every foreign key to `players` cascades. Player removal is limited to players without activity (DECISIONS 024).
- After a migration: `npx supabase db reset`, `npm run db:types`, `npm run db:test`. Add pgTAP tests for new database rules. To ship it: `npx supabase db push --remote --dry-run`, then without `--dry-run` (without `--remote` it targets local).
- Never `supabase config push`: `config.toml` has localhost URLs and would break production Auth. Cloud Auth settings are set by hand (DECISIONS 026).
- When running the Supabase CLI from the Bash tool, append `< /dev/null` or it hangs.
- Phone testing: `npm run dev:mobile` with `.env.mobile.local` (README). The magic link doesn't work from a phone locally.

## How to work

- Work in small phases. Before writing code in each phase, propose a plan and wait for approval.
- Explain decisions to the developer in Catalan, simply and directly. Code, comments, README and commits in English. UI copy is in Catalan.
- Log every significant decision and its reasoning in DECISIONS.md (useful for job interviews).
- When a phase is finished, add a "Fase N" section to `docs/INTERVIEW.md` with that phase's interview explanations, in Catalan, in the same format ("La frase", explanation, optional follow-up question, DECISIONS number).
- One commit per step, with clear conventional commit messages.
- Before committing frontend work: `npm run build` and `npm run lint` must pass. Check the flow in a real browser when possible.
- Prioritize a working MVP for the party day. Extras only if time allows.
