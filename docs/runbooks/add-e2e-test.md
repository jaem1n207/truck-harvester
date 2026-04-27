# Runbook: Add An E2E Test

Use this when a behavior needs route-level browser coverage for the rebuilt
Truck Harvester app. The user-facing app is `/`; `/v2` is only a compatibility
redirect and should not be the primary target for new tests.

## Browser Matrix

Keep the Playwright matrix broad enough to cover the app's real staff workflow:

- Onboarding: first visit, step navigation, persisted completion, and help
  restart.
- Happy-path batch: 10 pasted addresses parse, stream into readable chips, and
  save successfully.
- Chip-input workbench: mixed chat text extracts supported truck addresses and
  keeps readable listing labels.
- Partial-failure recovery: failed parse chips stay removable while successful
  listings can be saved, then the failed listing can be re-pasted and saved.
- Start-without-save-folder: saving chooses a folder from the user-triggered
  start flow and does not persist folder handles after reload.
- ZIP fallback: browsers without File System Access show compressed-file copy
  and download `truck-data-YYYY-MM-DD.zip`.
- Reduced motion: first-visit tour card and highlight stay visible without
  transform motion.
- A11y: root flow and onboarding overlay have no critical axe violations.

Per-listing in-progress cancellation is intentionally outside this matrix until
GitHub issue #8 owns that behavior.

## Steps

1. Add or update the spec under `e2e/`.
2. Navigate to `/`. Do not test new behavior through `/v2` unless the redirect
   itself is the behavior under test.
3. Reuse `e2e/truck-fixtures.ts` for onboarding, File System Access, ZIP
   fallback, and `/api/v2/parse-truck` mocks.
4. Mock external truck-site behavior and `/api/v2/parse-truck` responses unless
   the test is explicitly about real-network behavior.
5. Keep assertions on user-visible Korean labels and stable `data-tour` or
   `data-motion` anchors.
6. Add deferred matrix gaps as GitHub issues instead of leaving TODOs in the
   spec.

## Checks

- `bun run test:e2e -- --list`
- `bun run test:e2e -- e2e/<name>.spec.ts`
- `bun run test:a11y` when accessibility behavior changes

## Related Decisions

- `docs/decisions/0002-client-parallel-vs-server-parallel.md`
- `docs/decisions/0005-onboarding-tour-strategy.md`
