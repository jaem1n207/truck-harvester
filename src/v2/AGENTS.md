# src/v2 AGENTS.md

`src/v2` contains the parallel rebuild for `/v2`. Do not import legacy
watermark code here. Do not move or delete legacy `src/shared`,
`src/widgets`, or `src/app/page.tsx` while `/v2` is incomplete.

## Layer Map

- `design-system/`: token docs and TypeScript helpers for CSS variables.
- `shared/`: base utilities, UI primitives, stores, and cross-feature
  helpers that do not know about a specific widget.
- `entities/`: pure domain schemas for truck listings, input addresses,
  downloads, and per-item states.
- `features/`: business workflows such as parsing, retrying, saving, and
  onboarding.
- `widgets/`: composed UI blocks for the `/v2` page.

## Rules

- UI copy is Korean-only and written for non-technical dealership staff.
- Default client concurrency is `5`.
- `/v2` has no Sentry dependency.
- Use `src/app/v2/theme.css` tokens instead of raw colors in components.
- Keep public APIs explicit with `index.ts` files as slices grow.

## Knowledge Links

- Full flow map: `docs/architecture.md`
- Widget recipe: `docs/runbooks/add-widget.md`
- Token recipe: `docs/runbooks/add-design-token.md`
- Decisions: `docs/decisions/`
