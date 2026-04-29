# src/v2/application AGENTS.md

`src/v2/application` contains business workflow orchestration for the root
Truck Harvester app. It coordinates feature capabilities, browser adapters,
and workflow analytics without owning user-facing widgets.

## Responsibilities

- Own paste-preview-save use cases that span multiple feature slices.
- Keep business workflow code testable outside React when possible.
- Keep React lifecycle, abort controllers, and browser permission state inside
  hook adapters.
- Convert workflow facts to analytics through a workflow analytics adapter.

## Rules

- Application code may import from `src/v2/entities`, `src/v2/features`, and
  `src/v2/shared`.
- Application code must not import widgets.
- Features, shared helpers, and widgets must not import application code.
- UI components must not call analytics tracking functions directly.
- Workflow analytics observes facts and must not mutate prepared listing state.

## Knowledge Links

- Workflow architecture: `docs/architecture.md`
- Decisions: `docs/decisions/`
- Runbooks: `docs/runbooks/`
