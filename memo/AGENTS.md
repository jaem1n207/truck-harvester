# memo/AGENTS.md — Truck Harvester Planning Context

This guide explains how to use the `memo/` folder without mistaking historical
rebuild plans for the current runtime.

## Current State

Truck Harvester serves the rebuilt application at `/`. The old `/v2` URL is a
compatibility redirect, and `src/v2/*` remains only the internal implementation
namespace. The legacy route, legacy runtime folders, and image-stamping
pipeline were removed after cutover.

The active listing parse endpoint is `POST /api/v2/parse-truck`. It validates
one allowlisted address, fetches the listing within a 3.5-second budget, parses
HTML with Cheerio, and returns a typed listing result. Client-side preview
orchestration keeps concurrency 5.

## How To Treat Memo Files

- `memo/v2-rebuild-consensus-plan.md` is the approved historical phase plan.
  Its coexistence and cutover sections describe the project before root
  promotion; do not use them as current runtime facts.
- `memo/deep-interview-rebuild-truck-harvester.md` preserves original product
  requirements and acceptance criteria.
- `memo/design-system.md` preserves the original visual direction. Current
  tokens and motion rules live under `src/v2/design-system/`.
- `memo/useful-repo-context.md` is the short current orientation document and
  must stay aligned with runtime code, architecture, runbooks, and ADRs.

When a memo conflicts with `AGENTS.md`, `docs/architecture.md`, current code, or
an accepted ADR, treat the memo as historical unless it explicitly says it is
current.

## Current Stack

- Next.js App Router with Turbopack
- React 19 and TypeScript strict mode
- Tailwind CSS 4 and local shadcn-style primitives
- Zod domain and URL contracts
- Zustand vanilla stores
- Cheerio server-side HTML parsing
- Node `fetch` and hostname-scoped HTTPS certificate-chain recovery for listing
  and Autocafe performance-check requests
- Client-side concurrency 5
- File System Access API and JSZip fallback
- Vitest, Playwright, and axe
- Vercel deployment

## Run And Test

```bash
bun install
bun dev
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
bun run test:coverage -- --run
bun run test:e2e
bun run test:a11y
bun run build
```

Use `/` for application smoke checks. `/v2` should only redirect.

## Current Ownership Map

| Concern                          | Current source of truth                                    |
| -------------------------------- | ---------------------------------------------------------- |
| Root workflow composition        | `src/app/truck-harvester-app.tsx`                          |
| Parse API and error mapping      | `src/app/api/v2/parse-truck/route.ts`                      |
| Listing request and TLS recovery | `src/app/api/v2/parse-truck/fetch-listing-html.ts`         |
| CheckPaper redirects and TLS     | `src/v2/shared/lib/checkpaper-proxy.ts`                    |
| URL allowlist                    | `src/v2/entities/url/model.ts`                             |
| HTML parsing                     | `src/v2/shared/lib/parse-truck-html.ts`                    |
| Prepared-listing workflow        | `src/v2/features/listing-preparation/`                     |
| Client parse API and batching    | `src/v2/features/truck-processing/`                        |
| File and ZIP saving              | `src/v2/features/file-management/`                         |
| Runtime architecture             | `docs/architecture.md`                                     |
| Failed listing diagnosis         | `docs/runbooks/debug-failed-scrape.md`                     |
| TLS recovery rationale           | `docs/decisions/0006-listing-source-tls-chain-recovery.md` |
| Autocafe TLS rationale           | `docs/decisions/0007-autocafe-tls-chain-recovery.md`       |

## First Files For Work Starting In `memo/`

1. `AGENTS.md`
2. `memo/useful-repo-context.md`
3. `docs/architecture.md`
4. The relevant runbook and accepted ADR
5. The current implementation and its colocated tests

Read historical plans only after the current sources above establish the
runtime baseline.

## Guardrails

- Do not restore legacy routes, folders, or image stamping based on a
  historical phase description.
- Do not move batch concurrency to the server or add SSE; ADR-0002 keeps
  one-listing server requests and client orchestration.
- Do not disable TLS verification, replace the process-wide CA store, or
  downgrade listing or performance-check requests to HTTP. Follow ADR-0006,
  ADR-0007, and the failed scrape runbook.
- Do not add paid hosting, external scraping workers, or an error-monitoring
  SDK without a new approved decision.
- Keep user-facing copy Korean and non-technical.
