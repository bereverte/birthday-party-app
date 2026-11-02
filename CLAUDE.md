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
- Mobile-first, festive design with personality, not template-looking.

## How to work

- Work in small phases. Before writing code in each phase, propose a plan and wait for approval.
- Explain decisions to the developer in Catalan, simply and directly. Code, comments, README and commits in English.
- Log every significant decision and its reasoning in DECISIONS.md (useful for job interviews).
- One commit per step, with clear conventional commit messages.
- Prioritize a working MVP for the party day. Extras only if time allows.
