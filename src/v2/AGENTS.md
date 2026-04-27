# src/v2 AGENTS.md

`src/v2` contains the current truck harvester implementation used by the root
`/` route. The folder name remains `v2` to preserve the rebuild namespace and
avoid unnecessary import churn after cutover.

## Hard Rules

- Do not import deleted legacy shared/widget runtime folders.
- Do not add an external error-monitoring SDK.
- Do not add image stamping.
- Keep user-facing copy Korean-only and understandable for non-technical staff.

## Layer Map

- `design-system/`: token docs and TypeScript helpers for CSS variables.
- `shared/`: base utilities, UI primitives, stores, and cross-feature
  helpers that do not know about a specific widget.
- `entities/`: pure domain schemas for truck listings, input addresses,
  downloads, and per-item states.
- `features/`: business workflows such as parsing, retrying, saving, and
  onboarding.
- `widgets/`: composed UI blocks for the root page.

## Rules

- Default client concurrency is `5`.
- Use `src/app/theme.css` tokens instead of raw colors in components.
- Keep public APIs explicit with `index.ts` files as slices grow.

## Knowledge Links

- Full flow map: `docs/architecture.md`
- Widget recipe: `docs/runbooks/add-widget.md`
- Token recipe: `docs/runbooks/add-design-token.md`
- Decisions: `docs/decisions/`
