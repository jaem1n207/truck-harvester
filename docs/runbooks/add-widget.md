# Runbook: Add a v2 Widget

Use this when adding or changing a composed UI block under
`src/v2/widgets`.

## Steps

1. Read `AGENTS.md`, `src/v2/AGENTS.md`, and `src/v2/widgets/AGENTS.md`.
2. Decide whether the behavior belongs in a widget or in a lower layer.
   Business workflow code belongs in `src/v2/features`; reusable state
   belongs in `src/v2/shared/model`.
3. Add or update the widget under `src/v2/widgets/<name>/ui/`.
4. Export only the intended public surface through
   `src/v2/widgets/<name>/index.ts`.
5. Put all user-facing strings in `src/v2/shared/lib/copy.ts`.
6. Add component tests beside the widget under `ui/__tests__/`.
7. If the widget needs route-level behavior, add mocked Playwright
   coverage using `docs/runbooks/add-e2e-test.md`.

## Checks

- `bun run test -- --run`
- `bun run typecheck`
- `bun run lint`
- `bun run format:check`

## Related Decisions

- `docs/decisions/0003-design-token-strategy.md`
- `docs/decisions/0005-onboarding-tour-strategy.md`
