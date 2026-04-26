# src/v2/widgets AGENTS.md

`src/v2/widgets` contains composed UI blocks for the parallel `/v2`
experience. Widgets may import from `features`, `entities`, and
`shared`, but must not import legacy `src/widgets/*` or `src/shared/*`.

## Current Widgets

- `url-input/`: Korean address entry, validation, and entered-address
  list.
- `directory-selector/`: save-folder selection and zip fallback copy.
- `processing-status/`: streamed per-truck status cards and "주목 필요"
  recovery panel.

## Rules

- User-facing copy comes from `src/v2/shared/lib/copy.ts`.
- Keep controls self-explanatory for non-technical dealership staff.
- Use `src/v2/shared/model` selectors for status grouping instead of
  recalculating completion rules in each widget.
- Keep component tests close to each widget under `ui/__tests__`.

## Knowledge Links

- UI flow: `docs/architecture.md`
- Add a widget: `docs/runbooks/add-widget.md`
- Relevant decisions: `docs/decisions/0003-design-token-strategy.md`,
  `docs/decisions/0005-onboarding-tour-strategy.md`
