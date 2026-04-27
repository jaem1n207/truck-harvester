# src/v2/widgets AGENTS.md

`src/v2/widgets` contains composed UI blocks for the root app experience.
Widgets may import from `features`, `entities`, and `shared`, but must not
import deleted legacy widget or shared runtime folders.

## Current Widgets

- `url-input/`: Korean paste surface and prepared-listing chips.
- `directory-selector/`: save-folder selection and zip fallback copy.
- `processing-status/`: readable prepared-listing progress and completion
  summary.

## Rules

- User-facing copy comes from `src/v2/shared/lib/copy.ts`.
- Keep controls self-explanatory for non-technical dealership staff.
- Use exported feature/shared selectors for status grouping instead of
  recalculating completion rules in each widget.
- Keep component tests close to each widget under `ui/__tests__`.

## Knowledge Links

- UI flow: `docs/architecture.md`
- Add a widget: `docs/runbooks/add-widget.md`
- Relevant decisions: `docs/decisions/0003-design-token-strategy.md`,
  `docs/decisions/0005-onboarding-tour-strategy.md`
