# AGENTS.md

This guide is the first stop for Codex work in Truck Harvester. The
root `/` route serves the rebuilt truck harvester UI in this worktree.

## Mission

Truck Harvester helps Korean used-truck dealership staff turn truck
listing addresses into organized image folders or ZIP files. The active
root app uses the rebuilt implementation, keeps `/v2` as a compatibility
redirect only, saves fetched images directly, and makes a 10-address batch
feel fast, recoverable, and self-explanatory.

## Stack

- Next.js App Router with Turbopack.
- React 19, TypeScript strict mode, Tailwind CSS 4, shadcn-style
  primitives.
- Zustand vanilla stores for prepared-listing and onboarding state.
- Zod for domain contracts and URL extraction.
- Cheerio for server-side HTML parsing.
- Node HTTPS for hostname-scoped certificate-chain recovery when the listing
  source or Autocafe performance-check hop omits its public intermediate CA.
- Client-side preview concurrency helpers with default concurrency 5.
- Optional Umami Cloud analytics for aggregate work-funnel events and failed-listing diagnostics.
- Vitest, Playwright, and axe for the three-layer test scaffold.

## Run And Test Commands

- `bun dev` starts the app; use `/` for rebuilt app smoke checks.
- `bun run typecheck`
- `bun run lint`
- `bun run format:check`
- `bun run test -- --run`
- `bun run test:coverage -- --run`
- `bun run test:e2e`
- `bun run test:a11y`
- `bun run build`

## Where To Look

- `src/app/truck-harvester-app.tsx` is the root route composition layer.
- `src/app/api/v2/parse-truck/fetch-listing-html.ts` owns the listing-source
  request timeout and scoped TLS chain recovery.
- `src/v2/shared/lib/checkpaper-proxy.ts` owns the CheckPaper redirect
  literal-origin/path policy, shared timeout, and scoped Autocafe TLS chain
  recovery.
- `src/v2/shared/lib/performance-check-contract.ts` owns the typed
  not-registered response contract shared by the CheckPaper route, capture
  workflow, and save-result classification.
- The compatibility redirect page sends old `/v2` visits to `/`.
- `src/v2/design-system/` owns token and motion guidance.
- `src/v2/entities/` owns pure Zod schemas and discriminated unions.
- `src/v2/shared/` owns base utilities, UI primitives, and shared stores.
- `src/v2/features/` owns workflows: listing preparation, parsing, file
  saving, completion notifications, onboarding.
- `src/v2/widgets/` owns composed user-facing UI blocks such as the chip
  input, directory selector, and prepared status panel.
- `docs/architecture.md` explains the root app data flow.
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
- Treat `src/v2/*` as the internal implementation namespace, not a
  separate user-facing route.
- The old legacy route and legacy shared/widget runtime folders were
  removed after root cutover.
- Do not add an external error-monitoring SDK or image-stamping pipeline.
- Umami analytics may collect failed-listing URL, bounded unsupported input
  sample, vehicle number, and vehicle name only inside the approved
  failed-listing diagnostics event.
- All allowlisted upstream response bodies must use the shared bounded stream
  reader. Keep the current 2 MiB listing HTML, 4 MiB CheckPaper HTML/CSS, and
  16 MiB CheckPaper binary ceilings unless ADR-0008 is updated with payload
  evidence and boundary tests.
- User-facing copy is Korean-only and non-technical.
- Default preview/save concurrency is 5 unless a later ADR changes it.
- Never bypass listing-source TLS verification with
  `NODE_TLS_REJECT_UNAUTHORIZED=0`, `rejectUnauthorized: false`, or an HTTP
  downgrade.
- If the listing-source issuer or chain changes, update ADR-0006, the failed
  scrape runbook, the embedded certificate fingerprint, and regression
  coverage together.
- If the Autocafe issuer or chain changes, update ADR-0007, the incident
  reference, the failed scrape runbook, the embedded certificate fingerprint,
  and regression coverage together.
- Keep CheckPaper outbound targets on server-owned literal origins. Do not
  reintroduce user-derived host, explicit port, credentials, fragment,
  unrestricted path, or provider HTTP support.

## Knowledge Links

- Architecture: `docs/architecture.md`
- Add a widget: `docs/runbooks/add-widget.md`
- Add a design token: `docs/runbooks/add-design-token.md`
- Debug failed scraping: `docs/runbooks/debug-failed-scrape.md`
- Add an E2E test: `docs/runbooks/add-e2e-test.md`
- Listing source TLS recovery: `docs/decisions/0006-listing-source-tls-chain-recovery.md`
- Autocafe TLS recovery: `docs/decisions/0007-autocafe-tls-chain-recovery.md`
- Decisions: `docs/decisions/`
