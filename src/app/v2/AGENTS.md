# src/app/v2 AGENTS.md

`src/app/v2` is the route-level composition root for the parallel
rebuild. Keep orchestration here thin: compose widgets and features,
wire stores, and leave reusable logic in `src/v2/*`.

## Rules

- Do not import legacy `src/shared/*`, `src/widgets/*`, or watermark code.
- Keep user-facing text Korean-only and non-technical.
- The default batch concurrency stays `5` through
  `processTruckBatch()`.
- Page tests should prove the operational flow is mounted, not just a
  marketing or placeholder screen.
- Browser coverage starts with `bun run test:e2e` for the happy path and
  `bun run test:a11y` for axe checks. Keep e2e tests mocked at the
  network boundary unless the spec explicitly needs a real truck site.

## Knowledge Links

- Route flow: `docs/architecture.md`
- Add route-level coverage: `docs/runbooks/add-e2e-test.md`
- Relevant decisions: `docs/decisions/0002-client-parallel-vs-server-parallel.md`,
  `docs/decisions/0005-onboarding-tour-strategy.md`
