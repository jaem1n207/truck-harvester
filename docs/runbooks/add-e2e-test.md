# Runbook: Add a v2 E2E Test

Use this when a behavior needs route-level browser coverage.

## Steps

1. Add the spec under `e2e/`.
2. Navigate to `/`. Keep `/api/v2/parse-truck` mocks when testing parsing.
3. Mock external truck-site and `/api/v2/parse-truck` responses unless
   the test is explicitly about real-network behavior.
4. Clear local storage when testing first-visit onboarding.
5. Keep assertions on user-visible Korean labels and stable `data-tour`
   anchors.
6. Add deferred matrix gaps as GitHub issues instead of leaving TODOs in
   the spec.

## Checks

- `bun run test:e2e -- --list`
- `bun run test:e2e -- e2e/<name>.spec.ts`
- `bun run test:a11y` when accessibility behavior changes

## Related Decisions

- `docs/decisions/0002-client-parallel-vs-server-parallel.md`
- `docs/decisions/0005-onboarding-tour-strategy.md`
