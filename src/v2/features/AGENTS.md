# src/v2/features AGENTS.md

Features contain business workflows that compose entities and shared
utilities. They may import from `src/v2/entities` and `src/v2/shared`, but
should not import widgets.

## Current Slices

- `listing-preparation/`: prepared-listing chips, preview scheduling, and
  status transitions before saving.
- `truck-processing/`: client-side parse API calls to `/api/v2/parse-truck`.
- `file-management/`: folder saving and ZIP fallback.
- `completion-notification/`: optional desktop completion notification.
- `onboarding/`: help menu and guided tour state.

## Rules

- Write tests before feature code.
- Keep API failure messages Korean and recovery-oriented.
- Default client concurrency is `5`.
- Do not import Sentry in `/v2`.

## Knowledge Links

- Workflow architecture: `docs/architecture.md`
- Scrape debugging: `docs/runbooks/debug-failed-scrape.md`
- Relevant decisions: `docs/decisions/0002-client-parallel-vs-server-parallel.md`,
  `docs/decisions/0004-concurrency-limiter-choice.md`
