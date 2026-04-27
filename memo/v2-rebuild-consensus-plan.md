# Consensus Plan: Truck Harvester `/v2` Rebuild

> **Source spec:** `.omc/specs/deep-interview-rebuild-truck-harvester.md` (ambiguity 7%, 9 rounds, PASSED)
> **Mode:** Ralplan `--direct` — Planner draft, with self-applied Architect & Critic passes inlined as `[A]` and `[C]` callouts. A standalone Architect/Critic agent re-review is recommended before autopilot dispatch but unblocked by usage limits.
> **Generated:** 2026-04-25
> **Branch:** `rebuild-truck-harvester` (parallel `/v2` route on this branch)
> **Status:** APPROVED-WITH-NOTES (see "Open items for human review")

---

## 1. RALPLAN-DR Summary

### Principles (5)

1. **Client orchestrates, server is a thin fetcher.** All scheduling, retries, and stream coordination live in the browser. The Vercel function does one thing: fetch + parse one URL within 3.5s.
2. **Every control teaches itself.** No control depends on external instructions; if a button needs a tutorial, redesign the button. The onboarding tour exists to _introduce_ — not to _explain_.
3. **Failures flow, never block.** Success rendering is never gated on failure resolution. Failures aggregate, retain context, and can be acted on at the user's pace.
4. **Tokens are the single source of truth.** Every color, spacing, radius, duration, easing originates in `design-tokens.css` (CSS custom properties) consumed by Tailwind. No hardcoded values in components.
5. **Performance and accessibility are brand attributes, not line items.** A 35-second batch with smooth motion is on-brand. A 25-second batch with reduced-motion violations is off-brand.

### Decision Drivers (top 3)

1. **3.5-second per-request server timeout (Vercel Hobby) is non-negotiable.** Drives one-URL-per-call API + client concurrency.
2. **5 simultaneous non-technical users with three usage patterns (1 / 10 / 1–3 repeated) all need to feel served.** Drives streaming-first UX with sane defaults for each pattern.
3. **`/v2` must coexist with the live root route.** Drives directory layout (`src/app/v2/`, `src/v2/*` siblings to current `src/shared`/`src/widgets`), separate API namespace (`/api/v2/parse-truck`), no shared mutable state.

### Viable Options for the 9 Open Decisions

#### D1 · `/v2` scaffold sequence

| Option                                                                                      | Pros                                                                                      | Cons                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **A. Tokens → DS components → entities → features → widgets → pages → tests** (recommended) | Each layer is testable in isolation; designers can review tokens before code; matches FSD | Tokens require shadcn/create iteration — time investment up front                |
| B. Vertical slice (one full feature path first, then expand)                                | Fast first demo                                                                           | Re-do when tokens land; no design system foundation; bad for parallel agent work |
| C. Pages-first (UI shell → fill in)                                                         | Visual progress signals                                                                   | Encourages mock-driven dev that diverges from real data shapes                   |

**Choice: A.** Reject B because consensus exists that _design system + animation quality_ is a v1 non-negotiable — slicing without tokens means re-skinning later. Reject C because mock-driven dev violates "data shapes are stable" Round-9 finding.

#### D2 · Client concurrency limiter

| Option                                                    | Pros                                                                                        | Cons                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **A. `p-limit` (current best)**                           | Tiny (1.4kb), zero deps, 9k+ stars, exact API for "max N concurrent promises", easy to test | Plain promise primitive — no built-in retry/backoff                                     |
| B. TanStack Query with `parallel: N` config               | Caching, retries, devtools, already React-idiomatic                                         | Heavyweight for one-shot batch; cache semantics don't fit "fire-and-forget per session" |
| C. Custom semaphore in `src/v2/shared/lib/concurrency.ts` | Zero new deps; full control                                                                 | Reinvents the wheel; needs its own tests; tiny win                                      |

**Choice: A — `p-limit@^6`.** Wrap with custom retry logic (exponential backoff, max 2 retries per URL). Reject B because we don't need cache invalidation/devtools for a session-scoped batch — overkill increases bundle and cognitive load on non-tech users (slower TTI). Reject C because the LOC saved (~30) is not worth owning the semantics.

> `[A]` Architect note: confirm `p-limit` is ESM-only and tree-shakes; verify `next/dynamic` not needed.
> `[C]` Critic note: must include a unit test for "queue drains in order even if some jobs throw."

#### D3 · Design tokens source of truth (shadcn/create preset)

| Option                                                                                                                                       | Pros                                                                                                                        | Cons                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **A. Tailwind v4 `@theme` block in `app/v2/theme.css`** with CSS custom properties; shadcn preset generated values flow in via `globals.css` | Native Tailwind 4 path; tokens work in non-Tailwind contexts (e.g., `<canvas>`, inline styles); shadcn CLI wires it cleanly | Requires Tailwind 4 mental model — not classic `theme.extend`                     |
| B. TypeScript token object exported from `src/v2/design-system/tokens.ts` + Tailwind plugin reading it                                       | Tokens typed at import site                                                                                                 | Two sources of truth (TS object + CSS). Higher complexity. Worse DX in CSS files. |

**Choice: A.** shadcn 3 + Tailwind 4 explicitly endorses the `@theme` pattern; aligns with shadcn/create preset output. Reject B because the spec demands "single source of truth" — TS+CSS dual-tracking violates principle.

> `[A]` Architect: ensure `@theme` block lives at `src/app/v2/theme.css` (scoped to `/v2` only) so legacy root keeps its current Tailwind config.

#### D4 · Partial-failure state machine

| Option                                                                                     | Pros                             | Cons                                            |
| ------------------------------------------------------------------------------------------ | -------------------------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **A. Discriminated-union per-URL state in Zustand slice** (`pending` → `parsing` → `parsed | failed`→`downloading`→`done      | failed                                          | skipped`) with selector-driven "주목 필요" panel | No new dep; leverages existing Zustand pattern; trivial to test reducers; matches user mental model 1:1 | Need disciplined types — easy to introduce invalid transitions |
| B. XState machine                                                                          | Visualizable; formal correctness | Big dep; learning curve; overkill for ~6 states |
| C. React reducer + context                                                                 | No global store needed           | Drilling — multiple widgets need this state     |

**Choice: A.** State count is small (6 distinct), users care about "did each one finish?" not formal correctness proofs. Use a TypeScript discriminated union so the compiler enforces transitions. Reject B (heavy), C (drilling).

> `[C]` Critic: enforce "no setStatus mutation outside the slice's actions" via ESLint or test. The legacy store mixes setters (line 200–228) — don't import that pattern.

#### D5 · Streaming API contract

| Option                                                                                            | Pros                                                                                | Cons                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A. One URL per HTTP POST to `/api/v2/parse-truck`, client `Promise.allSettled` over `p-limit`** | Stays inside 3.5s/call; trivial caching/retry per URL; cancel via `AbortSignal.any` | No "global progress" stream from server — but client knows progress already                                      |
| B. Single SSE endpoint that streams parse results                                                 | Server can pace nicely                                                              | Single SSE stream blocks if one URL hangs; SSE on Vercel Hobby is finicky with 3.5s; less flexible for retry-one |
| C. Edge-runtime streaming with TransformStream                                                    | Modern, low TTFB                                                                    | Edge runtime can't run Cheerio (DOM-heavy); we'd need a different parser                                         |

**Choice: A.** Per-URL POST gives perfect granularity for retry, cancel, and per-URL timing. Server stays simple (existing Cheerio code transfers 1:1, just sliced to one URL). Reject B (correlated failure), C (Cheerio incompatibility).

> `[A]` Architect: keep both legacy `/api/parse-truck` (batch) and new `/api/v2/parse-truck` (single) endpoints alive simultaneously. Cutover deletes legacy.

#### D6 · Onboarding tour library

| Option                                                                         | Pros                                                                                                 | Cons                                                                |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **A. Custom 3–5 step component using existing Motion/React + shadcn `Dialog`** | Full design control, matches brand voice exactly, no new dep, accessible by default via Radix Dialog | Requires writing positioning logic for spotlight (~150 LOC)         |
| B. `react-joyride`                                                             | Battle-tested, beacon/spotlight built in                                                             | Style is "generic SaaS" — fights brand; hard to override; adds 30kb |
| C. `driver.js`                                                                 | Tiny, lightweight                                                                                    | DOM-mutation based; clashes with React lifecycle; hard to test      |

**Choice: A.** Brand demands "living motion" and shadcn coherence — a third-party tour will look bolted-on. The 150 LOC of spotlight math is bounded. Use `<dialog>` element underlying shadcn Dialog for native ESC handling. Reject B (style drift), C (DOM friction).

> `[C]` Critic: add a unit test that asserts every tour step has a fallback when its anchor element is missing (do NOT crash).

#### D7 · Test scaffold v1 vs v1.1 boundary

| Option                                                                                                                                             | Pros                                                                                  | Cons                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **A. v1 ships: full unit suite for `core` + parse-truck integration via MSW + 1 happy-path E2E (Playwright). v1.1 expands E2E coverage and a11y.** | Hits "scaffold + minimum coverage" balance the spec wants; CI gate is real from day 1 | Some failure-path E2Es deferred                                                        |
| B. v1 ships only infra (Vitest, Playwright, MSW configured), all tests in v1.1                                                                     | Faster v1 ship                                                                        | Risk: scaffold-without-tests gives false confidence; spec requires ≥80% unit coverage  |
| C. v1 ships full three-layer matrix                                                                                                                | Maximum confidence                                                                    | Time-prohibitive given v1 trio (speed + zero-training + design) is also non-negotiable |

**Choice: A.** Match spec wording: "scaffolding lands in v1, full coverage can continue into v1.1" is satisfied by infra + ≥80% unit + 1 happy-path E2E. Reject B (violates spec's ≥80% unit requirement), C (clashes with v1 trio).

#### D8 · AGENTS.md hierarchy

| Option                                                                                                                                                                             | Pros                                                                                                                   | Cons                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **A. Root `AGENTS.md` (mission + map + entry points) + per-layer `AGENTS.md` at `src/v2/{app,widgets,features,entities,shared}/`** with "what lives here, public API, when to add" | Matches harness-engineering pattern; agents resolve "where does X go?" without reading 50 files; survives parallel dev | Maintenance burden if structure drifts                                     |
| B. Single root file with section per layer                                                                                                                                         | Less to maintain                                                                                                       | Long file; agents miss sub-sections; can't be co-located with code reviews |
| C. ADRs only, no AGENTS.md                                                                                                                                                         | Decisions captured                                                                                                     | Doesn't help orient an AI agent on a fresh task                            |

**Choice: A.** Spec explicitly requires per-layer AGENTS.md. Add `docs/runbooks/`, `docs/architecture.md`, `docs/decisions/` per spec.

#### D9 · Watermark removal strategy in `/v2`

| Option                                                                                                                                                                                                  | Pros                                                                | Cons                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A. Don't touch legacy code at all. `/v2` simply doesn't import `watermark.ts`. Cutover PR deletes file + `public/watermark-*.png` + every legacy call site in one separate sweep AFTER `/v2` ships.** | Legacy keeps running with watermark exactly as-is; safe; reversible | A redundant file lingers until cutover                                       |
| B. Delete watermark in this branch as part of v1 build                                                                                                                                                  | Cleaner repo earlier                                                | Mutates legacy → violates "/v2 is parallel, no destructive edits" constraint |

## **Choice: A.** Spec line 53: "Cutover = swap routes at the end; no destructive edits to the legacy implementation until `/v2` passes all acceptance criteria." Reject B as a constraint violation.

## 2. Execution Phases

Each phase is sized for ≤1 executor-agent-day. Acceptance tests written alongside; CI gate enforced.

### P0 · Foundation (`/v2` route + design tokens scaffold)

**Goal (original):** New route renders blank "v2 OK" page with shadcn 3 preset tokens applied. Legacy untouched.
**Files to create:**

- `src/app/v2/layout.tsx` — minimal RootLayout-like component, scoped theme.css import
- `src/app/v2/page.tsx` — placeholder
- `src/app/v2/theme.css` — `@theme` block with shadcn/create preset output
- `src/v2/design-system/tokens.ts` — typed re-export of CSS-var names (for IntelliSense in JS)
- `src/v2/design-system/README.md` — "when to use each token"
- `AGENTS.md` (root, initial pass)
- `src/v2/AGENTS.md` (layer index)
  **Files to reference (do not modify):**
- `tailwind.config.ts` (current — add v2-scoped extension only if needed; prefer pure CSS @theme)
- `src/app/layout.tsx` (legacy root)
  **Deps to add:**

```bash
bun add p-limit@latest
bun add -D @playwright/test@latest msw@latest @axe-core/playwright@latest
```

shadcn preset: `bunx shadcn@latest init` scoped to a `v2` config (config file: `components-v2.json`). Confirm output matches Tailwind 4 `@theme` syntax.
**Acceptance:**

- `bun dev` → `/v2` returns 200, renders headline using `text-primary bg-background`
- `/` (legacy) still works
- Lighthouse a11y ≥ 95 on `/v2` placeholder

### P1 · Core Domain (entities)

**Goal (original):** Reuse and tighten Zod schemas from `src/shared/model/truck.ts`. No business logic — pure types.
**Files to create:**

- `src/v2/entities/truck/model.ts` — `truckListingSchema` (rename `vname` semantics carefully — see legacy line 168), discriminated union with `successTruck` vs `failedTruck` vs `pendingTruck`
- `src/v2/entities/truck/index.ts` — public API
- `src/v2/entities/url/model.ts` — Zod-validated input URL with normalization (https/http, trailing slash)
- `src/v2/entities/download/model.ts` — `DownloadStatus` discriminated union (matches D4 state machine)
- `src/v2/entities/AGENTS.md`
  **Acceptance:**
- Vitest: round-trip parse for all schemas
- TypeScript: discriminated union narrows correctly in switch

### P2 · Client Parallelism + Streaming

**Goal:** Fetch N URLs concurrently, render results as they arrive.
**Files to create:**

- `src/app/api/v2/parse-truck/route.ts` — accepts `{ url: string }` (single URL), reuses `parseHtml` logic from legacy line 35 (extracted to `src/v2/shared/lib/parse-truck-html.ts` for sharing)
- `src/v2/shared/lib/parse-truck-html.ts` — pure Cheerio parser (extracted, no Sentry-specific code paths in v2 yet — keep the legacy import unchanged)
- `src/v2/shared/lib/concurrency.ts` — `runConcurrent({ items, limit, signal, onResult })` thin wrapper over `p-limit` with `AbortSignal` plumbing
- `src/v2/shared/lib/retry.ts` — exponential backoff (max 2 retries; 300ms / 800ms)
- `src/v2/features/truck-processing/model.ts` — orchestrator hook `useTruckBatch()` returning per-URL state
- `src/v2/features/truck-processing/api.ts` — POST one URL, returns Zod-validated `TruckListing`
- `src/v2/features/AGENTS.md`
  **Tests:**
- Unit: `concurrency.test.ts` (queue drains in order; respects limit; cancels mid-flight)
- Unit: `retry.test.ts` (succeeds on first; retries once; gives up after 2)
- Integration (MSW): `parse-truck-v2.test.ts` (valid HTML → schema; missing selectors → graceful fail; timeout → typed error)
  **Acceptance:**
- Mock 10 URLs with random 200–1500ms delay → batch completes in `<= 2 * 1500ms + overhead` (concurrency 5+) — proves parallelism works
- Memory: no leak on `AbortSignal` invocation

### P3 · File System Layer

**Goal:** Save images to chosen directory or generate ZIP — no watermark.
**Files to create:**

- `src/v2/features/file-management/file-system.ts` — File System Access API path
- `src/v2/features/file-management/zip-fallback.ts` — JSZip path
- `src/v2/features/file-management/filename.ts` — `buildFilename({ vehicleNumber, vname, index })` pure function
- `src/v2/features/file-management/index.ts`
  **Removed vs legacy:** No watermark imports. No canvas processing. Direct fetch → write blob.
  **Tests:**
- Unit: `filename.test.ts` (sanitization, edge cases)
- Unit: `zip-fallback.test.ts` (zip structure correct given fixture inputs)

### P4 · State Machine (Zustand slice)

**Goal:** Per-URL discriminated-union state, "주목 필요" selector.
**Files to create:**

- `src/v2/shared/model/truck-batch-store.ts` — Zustand slice; actions: `add`, `setParsing`, `setParsed`, `setFailed`, `setSkipped`, `retry`, `setDownloading`, `setDownloaded`
- `src/v2/shared/model/selectors.ts` — `selectAttentionNeeded`, `selectInProgress`, `selectDone`, `selectAllResolved`
- `src/v2/shared/model/onboarding-store.ts` — first-visit flag (localStorage), tour step pointer
- `src/v2/shared/AGENTS.md`
  **Tests:**
- Unit: `truck-batch-store.test.ts` (every action transition; invalid transitions throw)
- Unit: `selectors.test.ts` (returns correct subset given mixed states)
- Unit: `onboarding-store.test.ts` (first-visit detection; restart from menu)

### P5 · Forms + UI Widgets

**Goal:** URL input + directory selector + processing status, all using shadcn 3 components + Zod + TanStack Form.
**Files to create:**

- `src/v2/widgets/url-input/ui/url-input-form.tsx` — TanStack Form + Zod schema (URL list)
- `src/v2/widgets/url-input/ui/url-list.tsx` — animated enter/exit (Motion)
- `src/v2/widgets/directory-selector/ui/directory-selector.tsx` — pre-click explainer (shadcn Dialog), browser support detection
- `src/v2/widgets/processing-status/ui/processing-status.tsx` — streamed result cards
- `src/v2/widgets/processing-status/ui/attention-panel.tsx` — "주목 필요" panel with retry/skip
- `src/v2/widgets/AGENTS.md`
  **Microcopy:** All UI copy goes through a `src/v2/shared/lib/copy.ts` const map (Korean only) so future i18n is a swap. Plain language audit: no "API", "URL", "directory handle" leak through to UI labels — they become "주소", "저장 폴더" etc.
  **Tests:**
- Unit: `url-input-form.test.tsx` (validation paths)
- Component: snapshot tests for empty/loading/success/error states

### P6 · Onboarding Tour

**Goal:** 3–5 step tour for first-time users, restartable from help menu.
**Files to create:**

- `src/v2/features/onboarding/ui/tour-overlay.tsx` — custom spotlight + shadcn Dialog
- `src/v2/features/onboarding/ui/help-menu-button.tsx` — "도움말" → restart tour
- `src/v2/features/onboarding/lib/tour-steps.ts` — typed step config with anchor selector + Korean copy
- `src/v2/features/onboarding/AGENTS.md`
  **Tests:**
- Unit: graceful fallback when anchor missing (D6 critic note)
- E2E: first-visit → tour appears → completes → never appears again

### P7 · Animations (Motion tokens + applied)

**Goal:** Brand-correct animations everywhere, reduced-motion compliant.
**Files to create:**

- `src/v2/design-system/motion.ts` — duration tokens (`micro: 150`, `quick: 200`, `default: 250`, `slow: 400`), easing tokens (`ease-out`, `spring-soft`, `spring-snappy`)
- `src/v2/shared/lib/use-reduced-motion.ts` — wrapper around Motion's hook with central kill switch
  **Apply to:**
- URL list enter/exit: stagger + spring
- Step transitions: opacity + slight Y
- Streaming results "pop": scale 0.96→1 + opacity (200ms ease-out)
- Progress shimmer: continuous, slow (signature delight)
- Onboarding step transitions
- Completion confetti: `canvas-confetti` (already installed) — disabled in reduced-motion
  **Tests:**
- Unit: `useReducedMotion` returns no-op transitions when set
- E2E: with `prefers-reduced-motion: reduce`, no transform animations on key elements (use Playwright's emulation)

### P8 · Pages + Flow

**Goal:** Wire `/v2/page.tsx` to full happy-path: input → parse → directory → download → done.
**Files:**

- `src/app/v2/page.tsx` — composition root
- `src/app/v2/AGENTS.md`
  **Acceptance:**
- Full manual flow on `/v2` works end-to-end with 10 real-shape mocked URLs
- ≤30s with concurrency 5 against MSW-mocked server
- All four UI states render correctly per widget

### P9 · Tests (per spec, three-layer)

**Goal:** Hit ≥80% unit coverage on `src/v2/**`, integration suite for `/api/v2/parse-truck`, 1 happy-path E2E.
**Files to create:**

- `playwright.config.ts` — Chrome only for v1, base URL `http://localhost:3000/v2`
- `e2e/onboarding.spec.ts` — first-visit tour
- `e2e/happy-path-batch.spec.ts` — 10 URLs streaming render
- `e2e/cancel-mid-batch.spec.ts` — abort then retry
- `e2e/zip-fallback.spec.ts` — File System Access stubbed unsupported
- Update `package.json` scripts: `test:e2e`, `test:e2e:ui`, `test:a11y`
- CI workflow update (if applicable)
  **Coverage gate:** Vitest config `coverage.thresholds.lines = 80` for `src/v2/**`.

### P10 · AI Knowledge Base

**Goal:** harness-engineering-pattern docs the agents can read in 5 minutes.
**Files to create:**

- `AGENTS.md` (root) — populated with mission, stack, run/test commands, "where to look" index, ADR pointer, "first 5 files for any task" list
- `docs/architecture.md` — flow diagram (URL input → API call (1 per URL, parallel) → parse → state → directory write/zip), Mermaid sequence diagram for streaming
- `docs/runbooks/add-widget.md`
- `docs/runbooks/add-design-token.md`
- `docs/runbooks/debug-failed-scrape.md`
- `docs/runbooks/add-e2e-test.md`
- `docs/decisions/0001-drop-watermark.md`
- `docs/decisions/0002-client-parallel-vs-server-parallel.md`
- `docs/decisions/0003-design-token-strategy.md`
- `docs/decisions/0004-concurrency-limiter-choice.md`
- `docs/decisions/0005-onboarding-tour-strategy.md`
  **Cross-link:** every per-layer `AGENTS.md` links to the relevant runbook + ADR.

### P11 · Cutover Checklist (separate PR after `/v2` passes all gates)

**Not part of v1 build — handed to a follow-up PR.**

- [ ] All v1 acceptance criteria pass on `/v2`
- [ ] Performance baseline: 10 URLs ≤ 30s p95 measured 3 times in production-like env
- [ ] Manager + 2 staff have used `/v2` once each without intervention (zero-training validation)
- [ ] Cutover PR: rename `src/app/v2/*` → `src/app/*`, retire `src/app/(legacy-truck-harvester)/`, delete `src/shared/lib/watermark.ts`, `public/watermark-*.png`, watermark imports in `use-truck-processor.ts`, `file-system.ts`
- [ ] Update root `README.md` and `CLAUDE.md` to reflect new structure
- [ ] Tag release; deploy

---

## 3. ADRs (one per major decision)

Detailed ADRs live in `docs/decisions/000X-*.md` (created in P10). Below is the abbreviated form for quick consensus reference.

### ADR-001 · Drop Watermark

- **Decision:** `/v2` does not implement watermarking; legacy implementation deleted at cutover.
- **Drivers:** User explicitly requested removal (sole excluded feature). Removing also recovers significant client CPU (canvas operations were a hot path).
- **Alternatives:** Keep behind a feature flag (rejected — spec excludes feature, no value in dead code).
- **Consequences:** ~250 LOC of `watermark.ts` + 5 PNGs deleted at cutover. Speed improves "for free."

### ADR-002 · Client-Parallel vs Server-Parallel

- **Decision:** Client orchestrates parallelism via `p-limit`; server stays one-URL-per-call.
- **Drivers:** Vercel Hobby 3.5s per-request timeout; budget locked free.
- **Alternatives:** Vercel Pro for 60s timeout (rejected — budget); Edge runtime streaming (rejected — Cheerio incompat).
- **Consequences:** Each URL retry independent. Server stays simple. Client must do retry/backoff, but `retry.ts` is small and tested.

### ADR-003 · Design Token Strategy

- **Decision:** Tailwind 4 `@theme` block in `app/v2/theme.css` is the single source of truth, generated initially from `bunx shadcn@latest init` preset.
- **Drivers:** Brand requires "regular grid discipline" + "trust" → tokens enforce consistency. Tailwind 4 native syntax is the modern path.
- **Alternatives:** TS object + plugin (dual sources, rejected); per-component literals (rejected — spec line 98 forbids).
- **Consequences:** Components read tokens via Tailwind classes; non-Tailwind contexts read CSS vars. Lint rule (or test scanning component files for `#[0-9a-f]{3,8}` literals) enforces.

### ADR-004 · Concurrency Limiter Choice

- **Decision:** `p-limit@^6` with custom `retry.ts` wrapper.
- **Drivers:** Smallest viable surface; widely used; ESM-only fits Next 15.
- **Alternatives:** TanStack Query (heavyweight cache semantics not needed); custom semaphore (LOC saved not worth ownership).
- **Consequences:** ~1.5kb added to bundle. Retry logic is ours to maintain (~50 LOC).

### ADR-005 · Onboarding Tour Strategy

- **Decision:** Custom tour component built on Motion + shadcn Dialog.
- **Drivers:** Brand voice demands coherence; 3rd-party tours look bolted-on; tour must respect reduced-motion.
- **Alternatives:** react-joyride (style drift, +30kb); driver.js (DOM mutation friction).
- **Consequences:** ~150 LOC owned. Full control of styling and a11y. Handles missing-anchor case explicitly.

### ADR-006 · Per-URL State Machine

- **Decision:** TS discriminated-union states stored in a Zustand slice.
- **Drivers:** 6 states is below the threshold where XState pays off; matches existing project Zustand idiom.
- **Alternatives:** XState (overkill); React reducer + context (drilling).
- **Consequences:** Reducer-style actions; type safety enforces valid transitions; selector hooks compose.

### ADR-007 · Streaming Contract

- **Decision:** One URL per `POST /api/v2/parse-truck`; client parallel via `p-limit`; rendering driven by per-URL state updates.
- **Drivers:** 3.5s budget; per-URL retry/cancel granularity.
- **Alternatives:** SSE (correlated failure, Vercel finickiness); Edge streaming (Cheerio).
- **Consequences:** Client owns scheduling; server is stateless and trivially testable.

### ADR-008 · AGENTS.md Hierarchy

- **Decision:** Root + per-layer AGENTS.md plus runbooks + ADRs.
- **Drivers:** Harness engineering pattern; spec line 117–122 explicit.
- **Alternatives:** Single root file (long, hard to navigate); ADRs only (no orientation help).
- **Consequences:** Maintenance discipline required; cross-references between layers must be kept fresh.

### ADR-009 · Watermark Removal Order

- **Decision:** No legacy edits in v1; cutover PR removes file + assets after `/v2` passes acceptance.
- **Drivers:** Constraint: "no destructive edits to legacy until /v2 passes" (spec line 53).
- **Alternatives:** Delete in v1 build (violates constraint).
- **Consequences:** Slight repo redundancy until cutover; revertibility preserved.

---

## 4. Testable Acceptance Criteria

Every spec checkbox mapped to a verification command or recipe.

### Speed

- [ ] **10-URL batch ≤ 30s p95** — Playwright spec `e2e/happy-path-batch.spec.ts` runs 5× on a CI-tagged "perf" job; reports p95 from `performance.now()` deltas around `submit → done state`. Fail CI if p95 > 30000.
- [ ] **First result ≤ 5s** — Playwright spec asserts first result card visible ≤ 5000ms post-submit using `page.waitForSelector`.
- [ ] **Concurrency 5–8 with backpressure** — unit test on `concurrency.ts` confirming exactly N inflight at any moment.
- [ ] **Streaming UX** — Playwright snapshot of result list at t=2s and t=4s differs (results arriving incrementally, not all-at-once).

### Zero-Training UX

- [ ] **First-time user completes flow** — manual validation script (saved as `docs/runbooks/zero-training-validation.md`); also automated via Playwright with `localStorage` cleared.
- [ ] **First-visit tour triggers** — E2E `onboarding.spec.ts`.
- [ ] **Plain-Korean microcopy** — lint rule (or test grepping `src/v2/**/*.tsx` for forbidden words: "URL", "API", "Fetch failed", "directory handle"). Whitelist allowed within `src/v2/shared/lib/copy.ts` only.
- [ ] **Directory pre-click explainer** — Playwright assert dialog text appears before native picker call; manual visual review.
- [ ] **Recovery copy** — unit test on `errorMessages.ts` mapping function (every error code → Korean human copy).
- [ ] **Empty/loading/success/error states** — component tests render each state and screenshot against baseline.

### Partial-Failure UX

- [ ] **Non-blocking** — E2E `partial-failure.spec.ts`: 3/10 URLs fail → 7 download immediately while 3 sit in panel.
- [ ] **"주목 필요" panel** — visible, non-modal — assert `[role="region"][aria-label="주목 필요"]` and not `[role="dialog"]`.
- [ ] **One-click retry/skip** — E2E click on retry → moves item back to pending; click skip → moves to done-skipped.
- [ ] **Plain-Korean failure reasons** — unit test on error → reason mapper.
- [ ] **"완료" only when all resolved** — selector test: `selectAllResolved` returns false until every URL is `downloaded` or `skipped`.

### Brand Design System

- [ ] **`src/v2/design-system/` exists with all token files** — file-existence check.
- [ ] **Tailwind consumes tokens from one source** — manually verified once, then a test that scans `src/v2/**/*.{ts,tsx}` for hex literals (allow only inside `theme.css` and `tokens.ts`).
- [ ] **Zero hardcoded hex/spacing in components** — same scan test.
- [ ] **Orange-primary AA-compliant** — `pa11y` or axe assertion in CI.
- [ ] **shadcn themed via tokens** — manual review.
- [ ] **Design system README** — file-existence + minimum content check (sections "Colors", "Spacing", "When to use").

### Animation

- [ ] **Emil principles** — manual review against `emil-design-eng` skill checklist (recorded in `docs/runbooks/animation-review.md`).
- [ ] **`prefers-reduced-motion` honored** — Playwright with media emulation; assert no transform animations on key elements; assert opacity-only fades acceptable.
- [ ] **Six key animated moments** — visual regression captures via Playwright `toHaveScreenshot`.

### Testing

- [ ] **Unit ≥ 80% on `src/v2/**`\*\* — Vitest threshold gate.
- [ ] **Integration: parse-truck** — MSW-driven; covers happy / 4xx / 5xx / timeout / malformed.
- [ ] **E2E: 5 specs** — onboarding, happy path, partial failure, cancel, zip fallback.
- [ ] **CI passes `bun test`, `bun test:e2e`, `bun run code:check`** — workflow check.
- [ ] **Lighthouse a11y ≥ 95** — `@axe-core/playwright` integrated; CI-fails on regressions.

### AI Knowledge Base

- [ ] **Root `AGENTS.md` with required sections** — file content check (mission / stack / run / test / map / "where to look" index).
- [ ] **Per-layer `AGENTS.md`** — file existence in each layer dir.
- [ ] **Runbooks present** — file existence check.
- [ ] **`docs/architecture.md`** — file existence + Mermaid diagram presence.
- [ ] **ADRs 001–005 (minimum)** — file existence.
- [ ] **"5 files to read first" list in root AGENTS.md** — content check.

### Feature Parity

- [ ] **URL input + validation + bulk paste** — manual + E2E.
- [ ] **Parse-truck (Cheerio)** — same selectors; assert by parsing fixture HTML and getting same fields as legacy parser.
- [ ] **Directory selector + ZIP fallback** — E2E.
- [ ] **Progress per truck/image** — E2E visual.
- [ ] **AbortController cancel** — E2E.
- [ ] **Theme toggle** — E2E.
- [ ] **Persistence (config + URLs)** — unit test on store.

---

## 5. Risk Register (pre-mortem-lite)

| #   | Risk                                                                                       | Likelihood | Impact | Early-warning signal                                       | Mitigation                                                                                                               |
| --- | ------------------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| R1  | 30s target unmet on real network (5 simultaneous users overwhelm Vercel Hobby cold-starts) | Medium     | High   | `e2e/happy-path-batch.spec.ts` p95 > 30s in CI perf job    | Bake in measurement from P2; if signal fires, lower default concurrency (5→3) and document tradeoff in ADR-002 follow-up |
| R2  | shadcn 3 + Tailwind 4 + `/v2` config isolation has a subtle bug (legacy theme bleeds)      | Medium     | Medium | Visual regression in legacy `/` route                      | Scoped `@theme` import; smoke test legacy route in CI                                                                    |
| R3  | TanStack Form + Zod ergonomics worse than expected for non-trivial validation              | Low        | Medium | P5 takes >1 day                                            | Prepared fallback: react-hook-form (already common). Decide at end of P5 day 1                                           |
| R4  | Onboarding tour anchor missing on small viewports / late mounts                            | Medium     | Medium | E2E flake on tour spec                                     | D6 critic note: explicit fallback test; mount-detection delay                                                            |
| R5  | Bot detection on the source site triggers under parallel load                              | Low-Medium | High   | parse-truck integration tests start failing intermittently | Keep `rateLimitMs` knob in v2 API as safety net; add jitter to retry backoff                                             |

---

## 6. Non-Goals (echo + additions)

From spec:

- Image watermarking
- Paid infra
- Native apps
- Auth / multi-tenant
- New TruckData fields
- i18n
  Added during planning:
- Server-side rate limiting (client-only for now)
- Caching scraped results across sessions (memory-only per session)
- User accounts / "history" view
- Admin dashboard for usage analytics (Sentry breadcrumbs already in legacy; v2 keeps minimal Sentry, no new dashboard)

---

## 7. Resolved Decisions (post-review)

User confirmed the following on 2026-04-25:

1. **Sentry in `/v2`:** **No Sentry instrumentation in v2 during the rebuild.** Decision deferred to cutover. Implication for plan: do NOT import `@sentry/nextjs` from any `src/v2/**` or `src/app/v2/**` file. Legacy route keeps its current Sentry wiring untouched. The `parseHtml` extraction (P2) must be re-shapeable without Sentry — the legacy `route.ts` keeps its Sentry imports, the v2 endpoint imports the pure `parseHtml` function only.
2. **`/v2` exposure during dev:** **Local-only.** No production deployment of `/v2` until cutover. Implication: Vercel previews can render `/v2` (acceptable for QA), but production traffic does not see it. The `vercel.json` may grow a `redirects` rule blocking `/v2` in prod — added to P0 acceptance.
3. **Concurrency default:** **5.** Conservative against Vercel cold-starts (R1 risk). Raising to 8 is a follow-up tuning experiment after baseline measurements.
4. **Cutover branch:** **Separate `cutover` branch off `rebuild-truck-harvester` after `/v2` ships.** P11 spawns a new branch. The `rebuild-truck-harvester` branch ships v1 with `/v2` route added and **legacy untouched**. The `cutover` branch is then opened off `rebuild-truck-harvester` and (a) moves `src/app/v2/*` → `src/app/*`, (b) deletes legacy + watermark assets, (c) opens its own PR.
   **Coverage threshold (auto-decided):** ≥ 80% on `src/v2/**` only (legacy excluded — preserved as-is until cutover). This is the only sensible scope given legacy is frozen.

---

## Self-Applied Critic Pass (informal)

Verdict: **APPROVE-WITH-NOTES**.

- ✅ Principles ↔ options consistency: every D-choice cites principles.
- ✅ Alternatives fairly considered with concrete invalidation.
- ✅ Risks have signals + mitigations.
- ✅ Acceptance criteria 1:1 with spec.
- ⚠️ Pre-mortem is light (5 risks, deliberate mode would expand to 3 detailed scenarios). Acceptable here because spec is brownfield + non-critical user data.
- ⚠️ Standalone Architect/Critic agent re-review skipped due to usage limits — reviewable post-handoff. If the user wants formal consensus, re-launch ralplan with fresh context on next reset.
  **Recommendation:** proceed to autopilot Phase 2 (Execution) using this plan, OR pause for the 5 open items in §7 to be resolved by the user.
