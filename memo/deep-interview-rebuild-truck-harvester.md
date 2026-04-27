# Deep Interview Spec: Truck Harvester — Zero-Training Rebuild

## Metadata

- Interview ID: rebuild-truck-harvester-2026-04-25
- Rounds: 9
- Final Ambiguity Score: **7%** (threshold: 20%)
- Type: brownfield (parallel-path rebuild at `/v2` on branch `rebuild-truck-harvester`)
- Generated: 2026-04-25
- Status: **PASSED (well below threshold)**
- Challenge modes used: Contrarian (R4), Simplifier (R6), Ontologist (R8)

## Clarity Breakdown

| Dimension          | Score | Weight | Weighted  |
| ------------------ | ----- | ------ | --------- |
| Goal Clarity       | 0.95  | 0.35   | 0.333     |
| Constraint Clarity | 0.90  | 0.25   | 0.225     |
| Success Criteria   | 0.95  | 0.25   | 0.238     |
| Context Clarity    | 0.90  | 0.15   | 0.135     |
| **Total Clarity**  |       |        | **0.930** |
| **Ambiguity**      |       |        | **0.070** |

## Goal

Rebuild the truck-harvester web app as a **parallel `/v2` route** so that a non-technical used-truck dealership staff member can process a batch of 10 truck-listing URLs into organized, downloaded image folders in **under 30 seconds**, with **zero external training** — an in-app onboarding carries a first-time user from landing to first successful download. Preserve every existing feature **except image watermarking**, and rebuild on top of a brand design system, thoughtful animations, a three-layer test suite, and an AI-friendly knowledge base so future long-running AI work stays on rails. The existing root route keeps running until `/v2` is complete; cutover happens by swapping routes, not by mutating the old code.

### v1 Non-Negotiables (from Simplifier round)

1. **Speed:** 10 URL ≤ 30s, first result ≤ 5s.
2. **Zero-training UX:** manager can hand a link to new staff with no instructions.
3. **Design system + animation quality:** shipped product must feel polished, not scaffolded.

### v1.1 / Can-Ship-Slightly-Later

- 3-layer test suite (unit/integration/E2E) — scaffolding lands in v1, full coverage can continue into v1.1.
- AI knowledge base (AGENTS.md tree, runbooks, ADRs) — initial shape lands in v1, depth iterates.

### Brand Voice (from Ontologist round)

The app's character is **"trust + speed + living motion + disciplined grid + progress-as-delight."** Specifically:

- **Issue-zero reliability** — non-technical users never hit a dead-end; every error is recoverable in-UI.
- **Fast service** — perf is a brand attribute, not just a goal.
- **Living-organism feel** — motion is natural, spring-based, precisely timed; never decorative for its own sake.
- **Regular grid discipline** — consistent spacing scale (4/8/16), column alignment, no "oops one more pixel" drift.
- **Progress indicators are the signature delight moment** — this is where the app earns emotional connection (shimmer, micro-flow animations, completion moments).
- Accessibility and perf are _part of the brand_, not line items. `prefers-reduced-motion` is respected everywhere.

## Constraints

- **Infrastructure: Vercel Hobby (free tier), forever.** 3.5s server timeout per request; no paid tier, no migration to other hosting. Architecture must work within this envelope.
- **Client-side parallel fetching + streaming** is the only viable path to the speed target. One URL per API call (not batch-per-call), client orchestrates concurrency, results render as they arrive.
- **Primary browser target:** Chrome/Edge on desktop (File System Access API). ZIP fallback retained for unsupported browsers, but Chrome is the first-class target.
- **Concurrent-user profile:** 5 dealership staff using simultaneously during office hours, with heterogeneous usage patterns (1 URL single-shot, 10 URL batch, 1–3 URL repeated many times).
- **Parallel-path rebuild at `/v2`** on branch `rebuild-truck-harvester`. Existing root route stays live untouched during development. Cutover = swap routes at the end; no destructive edits to the legacy implementation until `/v2` passes all acceptance criteria.
- **Tech freedom inside `/v2`:** each concern can pick its best-fit library — explicitly endorsed:
  - **Design system** via the **`shadcn/create` preset** flow (visual preset builder → tokens → themed base components).
  - **Forms** via **Zod + TanStack Form**.
  - Other concerns (concurrency-limiter, streaming, testing libs) pick the current best tool of the day.
- **Base stack (kept):** Next.js 15 App Router, Turbopack, Bun, TypeScript, Tailwind CSS 4, Motion/React for animation, Vitest for unit tests, Playwright for E2E.
- **Drop the watermark feature entirely** (only feature to be removed — including `src/shared/lib/watermark.ts`, `public/watermark-*.png`, and every call site).
- **Audience is 99% non-technical Korean users.** All UI copy avoids jargon; every control is self-explanatory or explained by the onboarding.
- **Respect `prefers-reduced-motion`** — animations enhance but never block or obscure.

## Non-Goals

- Image watermarking (removed: `src/shared/lib/watermark.ts`, `public/watermark-*.png`, every call site).
- Paid infrastructure, Vercel Pro, external scraping workers, queue systems.
- Native mobile apps, desktop apps, browser extensions.
- Authentication, multi-tenant user accounts, server-side state.
- Additional data fields beyond the current TruckData schema unless discovered during implementation.
- Internationalization (ko-KR only for now).

## Acceptance Criteria

### Speed (primary pain resolution)

- [ ] 10-URL batch end-to-end time ≤ **30 seconds** at p95 on a 50 Mbps+ connection (current baseline: ≥ 60s).
- [ ] First URL's parsed result streams into the UI ≤ **5 seconds** after submission.
- [ ] Client-side concurrency of **5–8 parallel API calls** with backpressure; one URL per API request (stays inside 3.5s Vercel Hobby limit).
- [ ] Streaming UX: each truck's data and image progress appears independently — no "wait for all" blocking.

### Zero-Training UX (primary onboarding bar)

- [ ] A first-time user (no prior exposure, no external instructions) completes their first successful URL → downloaded folder flow through an in-app onboarding.
- [ ] "First visit" detection via `localStorage` flag triggers a 3–5 step guided onboarding tour (skippable, restartable from help menu).
- [ ] Every primary control has plain-Korean microcopy — no jargon ("URL", "API", "directory handle" hidden or rephrased).
- [ ] Directory selection has a pre-click explainer ("무엇이 열리고, 왜 필요한가") with a native `<dialog>` or toast-style preview.
- [ ] Error states use recovery-oriented copy ("다시 시도해볼까요?" not "Fetch failed: 500"), with a one-click retry.
- [ ] Empty/loading/success/error UI states are all designed and implemented — no blank screens.

### Partial-Failure UX (zero-training guard)

- [ ] When some URLs succeed and some fail in a batch, the app **does not block** on failures — successful items auto-progress to download immediately.
- [ ] Failed items aggregate into a single **"주목 필요" (Attention Needed)** panel that's visible but non-modal.
- [ ] Each failed item exposes **one-click "다시 시도"** and **"건너뛰기"** actions — no need to re-enter the URL.
- [ ] Failure reasons translate to plain-Korean cause copy (listing deleted / typo / site timeout / unknown), not stack traces.
- [ ] The "완료" state is only reached when every URL has been either successfully downloaded OR explicitly skipped — no ambiguous "finished with errors" screens.

### Brand Design System

- [ ] `src/shared/design-system/` directory with: color tokens, typography scale, spacing scale, radius scale, elevation scale, motion tokens (duration, easing).
- [ ] Tailwind config consumes tokens from a single source of truth (`design-tokens.ts` or `theme.css` with CSS custom properties).
- [ ] **Zero hardcoded hex colors or raw spacing values in component files.** Lint rule or test enforces this.
- [ ] Orange-primary palette with light + dark mode, both AA-compliant (4.5:1 text, 3:1 large text, 3:1 focus).
- [ ] shadcn/ui base components themed through the token layer.
- [ ] Design system is documented in `src/shared/design-system/README.md` with "when to use each token" guidance.

### Animation (Emil Kowalski-inspired)

- [ ] Animations follow Emil Kowalski's principles: purposeful, fast (ease-out 150–250ms for micro-interactions), spring for drags/gestures, never "decorative for its own sake".
- [ ] Apply the `emil-design-eng` and `web-animation-design` skills during implementation.
- [ ] `prefers-reduced-motion: reduce` is honored in every animated component — motion replaced by opacity or omitted.
- [ ] Key animated moments: URL-list item enter/exit, step transitions, streaming results "pop" (scale 0.96→1 + opacity), download progress shimmer, onboarding tour micro-interactions, confetti on batch completion (reduced-motion respects off).

### Testing (three-layer)

- [ ] **Unit:** ≥ 80% coverage for core business logic (`url-validator`, `parse-truck` Cheerio selectors, filename-builder, concurrency-limiter, store reducers, onboarding state machine).
- [ ] **Integration:** Vitest + MSW for `/api/parse-truck` happy path, error paths (timeout, malformed HTML, missing selectors), rate-limit handling.
- [ ] **E2E:** Playwright covering: onboarding first-visit flow, single URL happy path, 10-URL batch with streaming render, File System Access success, ZIP fallback path, cancel mid-batch, error recovery.
- [ ] CI: `bun test`, `bun test:e2e`, `bun run code:check` all pass on every PR.
- [ ] Accessibility: Lighthouse accessibility ≥ 95, `@axe-core/playwright` runs on all E2E routes.

### AI Knowledge Base (harness engineering pattern)

- [ ] Root `AGENTS.md` — mission, stack, how to run, how to test, directory map, "where to look for X" index.
- [ ] Per-layer `AGENTS.md` at `src/app/`, `src/widgets/`, `src/features/`, `src/shared/` with slice responsibilities and public API descriptions.
- [ ] `docs/runbooks/` — "add a new widget", "add a new design token", "debug a failing scrape", "add a new E2E test".
- [ ] `docs/architecture.md` — data flow diagram (URL → API → parse → stream → download), state machine for processing steps.
- [ ] `docs/decisions/` — ADR folder for major rebuild decisions (ADR-001: why drop watermark, ADR-002: client-parallel vs server-parallel, ADR-003: design token strategy).
- [ ] Onboarding checklist for AI agents: "read these 5 files and you can work anywhere in the repo".

### Feature Parity (everything except watermark)

- [ ] URL input with validation, add/remove, bulk paste.
- [ ] Parse-truck API (Cheerio-based) — same data extraction, same selector targets.
- [ ] Directory selector (File System Access API) with ZIP fallback.
- [ ] Processing status with per-truck, per-image progress.
- [ ] Cancel mid-batch via AbortController.
- [ ] Dark/light/system theme toggle.
- [ ] Zustand persistence for config and URLs-in-progress only (same as today).

## Assumptions Exposed & Resolved

| Assumption                                | Challenge                                      | Resolution                                                                                                 |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| "More speed" is a vague direction         | Asked for usage pattern + concrete number      | **10 URL ≤ 30s** (2× current), first result ≤ 5s                                                           |
| Speed can be fixed on the server          | Contrarian: "What if server is fixed at 3.5s?" | Client-parallel + streaming, one URL per API call                                                          |
| Paid infra is acceptable to hit speed     | Contrarian: asked budget                       | **Infra stays free (Vercel Hobby) — hard constraint**                                                      |
| "Good UX" is subjective                   | Asked for testable bar                         | **Zero-training** — manager confidence that link-only handoff works                                        |
| Rebuild needs destructive edits to src/   | Asked migration strategy                       | **Parallel `/v2` route** — existing app stays live, cutover at end                                         |
| One tech stack for everything             | User clarified at R7                           | **Tech freedom per concern** — shadcn/create preset, Zod + TanStack Form, best-fit libs permitted          |
| All seven rebuild axes are equally urgent | Simplifier: what's non-negotiable?             | **v1 = speed + zero-training + design/animation**; tests + AI KB scaffold in v1, depth in v1.1             |
| All five staff have same workflow         | Round 1 answer exposed three patterns (A/B/C)  | UX must serve 1-shot, batch, and iterative-repeat patterns equally                                         |
| "Better design" is subjective             | Ontologist: what IS the brand?                 | **Trust + speed + living motion + disciplined grid + progress-as-delight**; a11y/perf are brand attributes |
| Partial failure blocks the batch          | Asked concrete failure scenario                | **Non-blocking**: success flows, failures aggregate in "주목 필요" panel with one-click retry/skip         |

## Technical Context (Brownfield)

### Current architecture (what we're rebuilding)

- Next.js 15 App Router, Turbopack, Bun package manager
- `src/app/api/parse-truck/route.ts` — **sequential** URL fetching with `rateLimitMs` (this is the primary speed bottleneck)
- `src/shared/lib/file-system.ts` — File System Access API + JSZip fallback
- `src/shared/lib/watermark.ts` — **to be removed** (client-side canvas watermarking)
- `src/shared/model/store.ts` — Zustand with persistence, step-based UI
- `src/widgets/{url-input,directory-selector,processing-status}/` — widget-based UI
- Tests: 3 files (~455 lines) — `url-validator`, `file-system`, `parse-truck` API route

### Files to remove in rebuild

- `src/shared/lib/watermark.ts`
- `public/watermark-{1..5}.png`
- `calculateWatermarkIndex` import + call in `src/shared/lib/use-truck-processor.ts`
- Watermark application path in `src/shared/lib/file-system.ts`
- Any `TruckData` watermark-related fields (verify in `src/shared/model/truck.ts`)

### Performance hotspots (attack plan)

1. **Sequential URL fetching in `parse-truck/route.ts`** → invert: client orchestrates parallel calls, one URL per request.
2. **Per-image canvas watermarking** → deleted with watermark removal (big win for free).
3. **Blocking "wait for all trucks" UI** → switch to streaming result list with per-truck progress cards.

## Ontology (Key Entities)

| Entity         | Type        | Fields                                                                           | Relationships                                 |
| -------------- | ----------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| Dealer         | core domain | name, office_id                                                                  | manages many Staff; owns brand confidence bar |
| Staff          | core domain | usage_pattern (A: single / B: batch-10 / C: repeat-1to3), skill_level (비전공자) | performs Sessions                             |
| URL            | core        | raw_url, validation_state                                                        | parsed into TruckListing                      |
| TruckListing   | core        | vname, vnumber, year, mileage, price, images[]                                   | derived from URL; produces ImageSet           |
| ImageSet       | core        | images[], target_directory, download_status[]                                    | owned by TruckListing; written to disk        |
| Session        | supporting  | current_step, concurrency_state, abort_controller                                | groups one user's URL → download journey      |
| OnboardingFlow | supporting  | first_visit_flag, current_step, completed_steps[]                                | gates Session on first use                    |

## Ontology Convergence

| Round | Entity Count | New                | Changed | Stable | Stability Ratio |
| ----- | ------------ | ------------------ | ------- | ------ | --------------- |
| 1     | 6            | 6                  | —       | —      | N/A             |
| 2     | 6            | 0                  | 0       | 6      | 100%            |
| 3     | 6            | 0                  | 0       | 6      | 100%            |
| 4     | 6            | 0                  | 0       | 6      | 100%            |
| 5     | 7            | 1 (OnboardingFlow) | 0       | 6      | 85.7%           |
| 6     | 7            | 0                  | 0       | 7      | 100%            |
| 7     | 7            | 0                  | 0       | 7      | 100%            |
| 8     | 7            | 0                  | 0       | 7      | 100%            |
| 9     | 7            | 0                  | 0       | 7      | 100%            |

The domain converged by Round 2 and stayed stable through Round 4. Round 5 introduced `OnboardingFlow` because the user named zero-training as a success criterion — a legitimate new entity, not instability. Rounds 6–9 added no new entities; the domain is fully stable at 7 entities across 5 consecutive rounds.

## Interview Transcript

<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1 — Targeting: Goal + Success Criteria (initial ambiguity 85%)

**Q:** 이 도구를 실제로 쓰는 사람 / 상황을 가장 잘 설명하는 것은? (한 세션당 몇 개 URL, 얼마나 자주?)
**A:** 중고트럭 딜러 본인 및 딜러 사무실 비전공자 직원들이 주 2~3회 사용. 같은 시간대 5명 동시 접속. A직원 = 1 URL/세션, B직원 = 10 URL 일괄, C직원 = 1~3 URL 반복 — 직원마다 다른 사용 패턴.
**Ambiguity after R1:** 55% (Goal 0.55, Constraints 0.40, Criteria 0.15, Context 0.80)

### Round 2 — Targeting: Success Criteria

**Q:** 지금 이 도구의 '가장 아프고 큰 불만 한 가지'는?
**A:** URL 처리가 너무 느림 — 10개 처리하는 동안 기다리는 시간이 짜증남.
**Ambiguity after R2:** 44% (Goal 0.70, Criteria 0.40)

### Round 3 — Targeting: Success Criteria (수치)

**Q:** URL 10개 일괄 처리 — 지금 몇 초/분, 재구축 후 몇 초 이하면 성공?
**A:** 현재 대략 1분 이상 — 30초 이하로 줄이면 성공.
**Ambiguity after R3:** 33% (Criteria 0.70)

### Round 4 — 🔵 Contrarian Mode — Targeting: Constraints (인프라/예산)

**Q:** 속도 목표 달성엔 서버 병렬 + 긴 타임아웃이 필요. Vercel Hobby의 3.5초는 큰 장벽. 배포/인프라 제약을 어떻게?
**A:** 무조건 무료(Vercel Hobby) 유지 — 클라이언트 병렬 처리 + 스트리밍으로 돌파.
**Ambiguity after R4:** 23% (Constraints 0.75)

### Round 5 — Targeting: Success Criteria (UX/온보딩/디자인)

**Q:** 속도 외 영역(UX/온보딩/디자인)에서 "성공"을 판별할 척도로 가장 가까운 것은?
**A:** 내부 딜러(관리자) 사이드에서 '다른 교육 없이 직원에게 링크만 넘겨도 되겠다'는 확신이 생길 정도의 완성도.
**Ambiguity after R5:** 17.5% (Goal 0.85, Criteria 0.85)

### Round 6 — 🟢 Simplifier Mode — Targeting: Goal (priority)

**Q:** v1 인수에서 절대 후순위로 밀리면 안 되는 축은?
**A:** 속도, zero-training, 디자인 시스템 + 애니메이션 품질.
**Ambiguity after R6:** 16% (Goal 0.90) — v1 non-negotiable trio confirmed; tests + AI KB scaffold in v1, depth in v1.1.

### Round 7 — Targeting: Constraints (재구축 방식)

**Q:** 재구축 방식은? (src 비우고 재작성 / 점진 교체 / 병행 /v2 / 당신이 추천)
**A:** 병행 새 경로(`/v2`) — 기존 앱은 그대로, 새 경로에서 완성되면 스위칭. 각 작업에 가장 적합한 기술/패키지 사용 OK (shadcn preset으로 디자인 시스템, Zod + TanStack Form으로 폼 등).
**Ambiguity after R7:** 11% (Constraints 0.90)

### Round 8 — 🟣 Ontologist Mode — Targeting: Criteria (브랜드 본질)

**Q:** 이 앱을 쓴 직원이 입 밖에 낼 소감에 가장 가까운 것은?
**A:** ① 이슈 제로 ② 빠른 서비스 ③ 살아있는 유기체처럼 자연스러운 움직임 + 접근성/성능/타이밍의 조화 + 진행 표시 시각적 재미 ④ 규칙적 레이아웃.
**Ambiguity after R8:** 9% (Criteria 0.93) — brand voice locked.

### Round 9 — Targeting: Criteria (부분 실패 UX)

**Q:** 10개 중 2개 실패 시 비전공자 직원이 경험해야 할 행동은?
**A:** 성공 8개는 바로 다운로드 진행 + 실패 2개는 '주목 필요' 영역에 모아서 원클릭 다시시도/건너뛰기 제공.
**Ambiguity after R9:** **7% ✅✅**

</details>
