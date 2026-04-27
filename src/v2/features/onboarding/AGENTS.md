# src/v2/features/onboarding AGENTS.md

The onboarding feature introduces first-time staff to the root app flow and
lets them restart the guide from the help control. Its code lives under the
internal `src/v2` namespace.

## Rules

- Keep tour copy Korean-only and non-technical.
- Each step needs a stable `data-tour` anchor plus a safe fallback so
  missing widgets never crash the tour.
- The store lives in `src/v2/shared/model/onboarding-store.ts`; UI
  components receive callbacks instead of importing a singleton store.
- Do not add a third-party tour library unless the rebuild plan is
  updated.

## Knowledge Links

- Onboarding in the flow: `docs/architecture.md`
- Add route-level coverage: `docs/runbooks/add-e2e-test.md`
- Relevant decisions: `docs/decisions/0005-onboarding-tour-strategy.md`
