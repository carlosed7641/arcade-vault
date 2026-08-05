# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: non-standard Next.js version

This project runs Next.js **16.2.10**, which has breaking changes vs. what's in your training
data — APIs, conventions, and file structure may differ. Before writing any Next.js code, read
the relevant guide in `node_modules/next/dist/docs/` (`01-app/`, `02-pages/`, `03-architecture/`,
`04-community/`, `index.md`) and heed deprecation notices.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm start` — serve production build
- `npm run lint` — ESLint (flat config: `eslint-config-next` core-web-vitals + typescript)

No test runner is configured yet.

## Skills

Usa siempre /frontend-design para diseñar la interfaz de usuario

Project skills live in `.claude/skills/` (also mirrored in `.agents/skills/`):

- `/spec` — writes a new numbered spec into `specs/` (spec-driven design method).
- `/spec-impl` — implements a spec already written in `specs/`.
- `/spec-impl-game` — same as `/spec-impl` (delegates to it) for specs that touch a game
  with a real engine; after the implementation plan is complete it automatically chains
  the `skin-designer` and then `mobile-porter` agents, one after the other, never in
  parallel.
- `/add-game` — designs the spec to integrate a real game (engine + canvas + Supabase
  leaderboard) into the Vault, following the SPEC 05/06 pattern. Asks clarifying questions
  about the game's state contract before proposing the spec; does not write code itself. See
  `.claude/skills/add-game/architecture.md` for the exact technical contract (types, catalog
  shape, leaderboard contract, and divergence table between reference game templates).

Agents live in `.claude/agents/`:

- `game-planner` — analyzes the catalog and recommends which game to integrate next; keeps
  memory in `references/game-suggestions.md`. Recommends only, doesn't implement.
- `game-jam` — takes a free-form theme and designs a brand-new arcade game (reskin of a
  classic mechanic) for it, writing two full specs into `specs/game-jam/<game-id>/` (engine+
  canvas, then Vault integration) following the SPEC 05/07 format. Runs autonomously, keeps
  memory in `references/game-jam-log.md`. Also doesn't implement — output feeds `/spec-impl`.
- `skin-designer` — audits and **implements** the 3 mandatory skins (`clasico` default,
  `neon`, `retro`, defined in `components/games/skins.ts`) for every game with a real
  engine, migrating stray hex/rgba literals in `engine.ts` to skin tokens and checking
  contrast (≥ 4.5:1 against the CRT's black background). Keeps memory in
  `references/skin-audit.md`.
- `mobile-porter` — audits and **implements** mobile web quality across the whole site
  (≤720px viewports): horizontal overflow, tap targets ≥44px, touch accessibility, and the
  SPEC 08 touch-control contract (`pressKey`/`releaseKey` + `TouchControls`) for every game
  with a real engine. Keeps memory in `references/mobile-audit.md`.

## Architecture

- App Router. Source lives in `app/` at the repo root (no `src/` dir).
  - `app/layout.tsx` — root layout (Geist fonts, global metadata)
  - `app/page.tsx` — home page
  - `app/globals.css` — Tailwind v4 entry point
  - `app/biblioteca/` — game library/catalog listing
  - `app/juegos/[id]/` — game detail page (info + real Supabase leaderboard)
  - `app/juegos/[id]/jugar/` — play page, renders the actual game canvas
  - `app/salon-de-la-fama/` — Hall of Fame (global leaderboard across games)
  - `app/login/` — Supabase auth (login/signup) via server actions in `actions.ts`
  - `app/acerca-de/` — About + contact form (sends email via Resend, `actions.ts`)
- `components/games/<game>/` — one folder per integrated game: a framework-agnostic
  `engine.ts` (game state/loop/physics) plus a React `<Game>Canvas.tsx` that owns the
  `<canvas>` element(s), input handling, and bridges engine callbacks
  (`onScoreChange`/`onLivesChange`/`onGameOver`) to React state. Implemented so far:
  `asteroids`, `tetris`. Canvas resolution is fixed internally and scaled via CSS.
- `components/games/skins.ts` — shared `Skin` type and the 3 mandatory skins (`clasico`
  default, `neon`, `retro`) every game engine consumes. `createEngine` takes an optional
  `initialSkin` and returns `setSkin()`; the skin lives as a mutable closure variable the
  draw loop reads each frame — switching skins never recreates the engine or restarts the
  run. Maintained by the `skin-designer` agent.
- `components/AuthProvider.tsx` — client-side auth context; wraps the Supabase user/session,
  exposes `user`, `logout()`, and `saveScore({ game, score })` used by game pages to persist
  runs to Supabase after game-over.
- `components/Nav.tsx`, `components/GameCard.tsx` — shared nav bar and catalog card.
- `lib/data.ts` — static game catalog (`GAMES`): id/title/category/color/cover/short/long +
  hardcoded display-only `best`/`plays` (not derived from Supabase, decided in SPEC 06).
- `lib/supabase/client.ts` / `server.ts` / `admin.ts` — browser, server-component, and
  service-role Supabase clients respectively.
- `proxy.ts` — Next.js proxy (this version's replacement for classic middleware) that
  refreshes the Supabase auth session on every request; do not add logic between
  `createServerClient` and `getUser()` in there.
- Supabase tables in use: `profiles` (id/username) and a scores table keyed by `game_id`,
  read by the leaderboard on game detail pages and written via `AuthProvider.saveScore`.
- Tailwind v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`) — there is no
  `tailwind.config.*` file.
- TypeScript strict mode, `noEmit`, `moduleResolution: bundler`. Path alias `@/*` → repo root.

## Environment variables

See `.env.template`: `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (contact form),
`SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` (Supabase auth/db).

## Product

Arcade Vault is an online platform for playing arcade games and competing for high scores.
Users can sign up/log in (Supabase auth), browse a game catalog, play real in-browser games
(Asteroids, Tetris so far), have their scores persisted to Supabase, and see per-game and
global (Hall of Fame) leaderboards.

## Workflow

Feature work follows Spec Driven Design using the `/spec` and `/spec-impl` skills from
[Klerith/fernando-skills](https://github.com/Klerith/fernando-skills):

```bash
npx skills@latest add Klerith/fernando-skills
```

Specs live in `specs/`, numbered sequentially (currently 01–07). New games are designed via
`/add-game` (produces a spec following the same format) before running `/spec-impl` on it.

`references/templates/started-games/` holds source templates for games not yet integrated
(e.g. `03-tetris` now integrated, `04-arkanoid` pending) — used as the starting point when
porting a game's engine into `components/games/`.
