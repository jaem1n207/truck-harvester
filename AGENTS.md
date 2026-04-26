# AGENTS.md

This guide is the first stop for Codex work in Truck Harvester. The
legacy root route and the parallel `/v2` rebuild coexist in this worktree.

## Mission

Truck Harvester helps Korean used-truck dealership staff turn truck
listing addresses into organized image folders or ZIP files. The `/v2`
rebuild is a parallel route that keeps legacy `/` working until cutover,
removes watermarking from the new flow, and makes a 10-address batch feel
fast, recoverable, and self-explanatory.

## Stack

- Next.js App Router with Turbopack.
- React 19, TypeScript strict mode, Tailwind CSS 4, shadcn-style
  primitives scoped to `/v2`.
- Zustand vanilla stores for `/v2` prepared-listing and onboarding state.
- Zod for domain contracts and URL extraction.
- Cheerio for server-side HTML parsing.
- `/v2` concurrency helpers for client-side preview concurrency 5.
- Vitest, Playwright, and axe for the three-layer test scaffold.

## Run And Test Commands

- `bun dev` starts the app; use `/v2` for rebuild work and `/` for legacy
  smoke checks.
- `bun run typecheck`
- `bun run lint`
- `bun run format:check`
- `bun run test -- --run`
- `bun run test:coverage -- --run`
- `bun run test:e2e`
- `bun run test:a11y`
- `bun run build`

## Where To Look

- `src/app/v2/` is the `/v2` route composition layer.
- `src/v2/design-system/` owns token and motion guidance.
- `src/v2/entities/` owns pure Zod schemas and discriminated unions.
- `src/v2/shared/` owns base utilities, UI primitives, and shared stores.
- `src/v2/features/` owns workflows: listing preparation, parsing, file
  saving, completion notifications, onboarding.
- `src/v2/widgets/` owns composed user-facing UI blocks such as the chip
  input, directory selector, and prepared status panel.
- `docs/architecture.md` explains the `/v2` data flow.
- `docs/runbooks/` contains repeatable change recipes.
- `docs/decisions/` contains ADRs for rebuild decisions.
- `memo/v2-rebuild-consensus-plan.md` remains the phase plan.

## First 5 Files For Any Task

1. `memo/v2-rebuild-consensus-plan.md`
2. `memo/useful-repo-context.md`
3. `AGENTS.md`
4. The nearest nested `AGENTS.md` for the layer you are editing
5. `docs/architecture.md`

## Scope Rules

- Do not switch branches in this worktree.
- Keep legacy `/`, `src/shared`, `src/widgets`, and `src/app/page.tsx`
  working until `/v2` cutover.
- Put `/v2` implementation under `src/app/v2/*` and `src/v2/*`.
- Do not import Sentry from `src/v2/**` or `src/app/v2/**`.
- Do not implement watermarking in `/v2`; legacy watermark code is removed
  only during the separate cutover PR.
- User-facing `/v2` copy is Korean-only and non-technical.
- Default preview/save concurrency is 5 unless a later ADR changes it.

## Knowledge Links

- Architecture: `docs/architecture.md`
- Add a widget: `docs/runbooks/add-widget.md`
- Add a design token: `docs/runbooks/add-design-token.md`
- Debug failed scraping: `docs/runbooks/debug-failed-scrape.md`
- Add an E2E test: `docs/runbooks/add-e2e-test.md`
- Decisions: `docs/decisions/`
