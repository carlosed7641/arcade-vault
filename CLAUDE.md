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

## Architecture

- App Router. Source lives in `app/` at the repo root (no `src/` dir).
  - `app/layout.tsx` — root layout (Geist fonts, global metadata)
  - `app/page.tsx` — home page
  - `app/globals.css` — Tailwind v4 entry point
- Tailwind v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`) — there is no
  `tailwind.config.*` file.
- TypeScript strict mode, `noEmit`, `moduleResolution: bundler`. Path alias `@/*` → repo root.

## Product

Arcade Vault is an online platform for playing arcade games and competing for high scores.

## Workflow

Feature work follows Spec Driven Design using the `/spec` and `/spec-impl` skills from
[Klerith/fernando-skills](https://github.com/Klerith/fernando-skills):

```bash
npx skills@latest add Klerith/fernando-skills
```
