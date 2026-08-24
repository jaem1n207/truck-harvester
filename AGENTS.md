# AGENTS.md

This guide is the first stop for Codex work in Truck Harvester. The
root `/` route serves the rebuilt truck harvester UI in this worktree.
`AGENTS.md` is the repository-level guidance source. `CLAUDE.md` is its
compatibility symlink; edit this file only.

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
- `src/v2/entities/url/model.ts` owns the fixed listing hostname/path and the
  legacy or encrypted listing identity strategies.
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

## Engineering Rules

- For human-facing writing—comments, commit messages, and prompt replies—use
  the fewest precise words possible.
- Avoid superlatives, praise, and agreement theater. State the facts.
- Avoid magic numbers and strings. Extract recurring or meaningful values into
  descriptive constants or enums. Keep self-explanatory one-offs inline.
  Values defined by a spec, such as HTTP 200 OK, always use constants.
- Reduce indentation with early returns and `continue`. Avoid the Arrow
  Anti-Pattern.
- Keep function names under 30 characters.
- Use enums instead of booleans for function parameters.
- Separate logical blocks with blank lines.
- Program to levels of abstraction. Encapsulate low-level mechanics, such as
  raw hardware I/O, sector parsing, and direct socket streams, in dedicated
  driver or abstraction layers. Expose domain-level APIs.
- Each layer may call only its immediate lower neighbor. UI and controllers
  must never call database queries, raw drivers, or low-level network clients
  directly; route through the intermediate service or abstraction layer.
- Always use braces, including one-line `if` statements.
- For bug fixes, write and run a failing test first. Implement the fix, then
  run the test again and observe it pass.

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
- If the listing identity key changes, update ADR-0009, the failed scrape
  runbook, the architecture document, and entity/paste/API regression coverage
  together.
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
- Listing URL identities: `docs/decisions/0009-listing-url-identity-strategies.md`
- Autocafe TLS recovery: `docs/decisions/0007-autocafe-tls-chain-recovery.md`
- Decisions: `docs/decisions/`
