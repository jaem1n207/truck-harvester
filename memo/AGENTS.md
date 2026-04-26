# AGENTS.md — Truck Harvester

> The harness-engineering knowledge base. If you're an AI agent landing
> in this repo on a fresh task, read this file first. Five minutes here
> saves an hour of exploration.

## Mission

Truck Harvester pulls vehicle listings from Korean used-truck sites,
parses spec/price/image data, and writes organized image folders to the
user's local disk. Five non-technical dealership staff use it 2–3× per
week with three distinct usage patterns (1 URL, 10 URL batch, 1–3 URL
repeated).

We are mid-rebuild. The active branch is `rebuild-truck-harvester`. The
legacy implementation lives at `src/app/page.tsx` + `src/widgets/*` +
`src/shared/*` and remains **untouched** during the rebuild. The new
implementation lives at `src/app/v2/*` + `src/v2/*` and ships
incrementally to a parallel `/v2` route. Cutover happens on a separate
`cutover` branch after `/v2` passes every acceptance gate.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Runtime:** Node.js (Bun for package management & scripts)
- **Language:** TypeScript (strict)
- **UI:** Tailwind CSS 4 (`@theme inline`), shadcn 3 (new-york style),
  Radix primitives, Motion/React, Lucide icons
- **Forms / validation:** Zod 4, TanStack Form 1
- **State:** Zustand 5 with `persist` middleware
- **Concurrency:** `p-limit` (v7; client-side parallel fetcher)
- **Scraping:** Cheerio (server-side route handler)
- **File I/O:** File System Access API + JSZip fallback
- **Testing:** Vitest 4 (unit + integration with MSW), Playwright (E2E,
  v1.0 has 1 happy-path spec; v1.1 expands)
- **Hosting:** Vercel Hobby (free, forever — every architectural
  decision honors the 3.5s server timeout)

## How to run

```bash
bun install
bun dev                 # http://localhost:3000 (legacy) and /v2 (rebuild)
bun run build           # production build
bun typecheck           # tsc --noEmit
bun test                # Vitest watch
bun run test:coverage   # coverage report
bun run code:check      # typecheck + lint + format-check + test
bun run code:fix        # lint --fix + format
```

## How to test

- **Unit tests** live next to source under `__tests__/*.test.ts`.
  Convention: keep tests close to the unit they cover.
- **Integration tests** for `/api/v2/parse-truck` use MSW to fake
  external HTML responses (P9).
- **E2E tests** live under `e2e/` and use Playwright (P9). Run with
  `bun run test:e2e` (script lands in P9).
- **Accessibility** is checked by `@axe-core/playwright` inside the E2E
  suite (P9). Lighthouse accessibility ≥ 95 is the gate.

## Where to look for X

| If you need...             | Look at...                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The rebuild plan           | `memo/v2-rebuild-consensus-plan.md`                                                                                    |
| The original requirements  | `memo/deep-interview-rebuild-truck-harvester.md`                                                                       |
| Legacy architecture        | `CLAUDE.md` § Architecture (the file you're reading is the new entry point; CLAUDE.md is preserved for legacy context) |
| v2 design tokens           | `memo/design-system.md`                                                                                                |
| v2 layer responsibilities  | `memo/AGENTS.md` (after P0/P1 land)                                                                                    |
| Architecture decisions     | `docs/decisions/000X-*.md` (created in P10)                                                                            |
| Runbooks                   | `docs/runbooks/` (created in P10)                                                                                      |
| Architecture diagram       | `docs/architecture.md` (created in P10)                                                                                |
| Existing Zod schemas       | `src/shared/model/truck.ts`                                                                                            |
| State management reference | `src/shared/model/store.ts` (legacy; v2 uses a discriminated-union per-URL state machine — see ADR-006 once written)   |

## First files to read for any v2 task

1. `memo/deep-interview-rebuild-truck-harvester.md` — what we're
   building and why.
2. `memo/v2-rebuild-consensus-plan.md` — phased execution plan +
   ADRs + risk register.
3. `memo/design-system.md` — visual language and token rules.
4. The neighboring code in the layer you're touching, plus its tests.

## What not to do

- Don't import from `src/shared/lib/watermark.ts` in v2. The watermark
  feature is intentionally excluded from v2 and will be deleted at
  cutover.
- Don't introduce server-side parallelism for URL parsing. The 3.5s
  Vercel Hobby timeout makes this infeasible — client orchestration
  (via `p-limit`) is the chosen approach (ADR-002).
- Don't pay for Vercel Pro / migrate hosting. The free-tier constraint
  is a hard requirement, not a preference.
