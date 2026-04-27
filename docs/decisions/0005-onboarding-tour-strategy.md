# ADR-0005: Onboarding Tour Strategy

## Status

Accepted.

## Context

First-time staff should understand the root `/` app flow without external
training. The old `/v2` URL is only a compatibility redirect, while
`src/v2/*` remains the internal implementation namespace. Third-party tour
libraries would add style drift and extra weight.

## Decision

Build a custom onboarding tour using the existing root app UI primitives and
Motion presets from the internal `src/v2` namespace. Each step uses a stable
anchor and a safe fallback when the anchor is missing.

The tour uses a spotlight overlay: the active `data-tour` anchor stays
visible, unrelated page regions are dimmed, and the explanation card is
placed near the active element. The tour supports previous/next controls and
keeps animation limited to opacity, transform, and position changes through
the shared Motion presets with reduced-motion fallbacks.

Each step may render compact example cards that show the user action and
the expected result without mutating real page state. The address step shows
an address-bar copy example and confirmed listing chip, the save-folder step
shows the selected folder and per-truck folder result, and the progress step
shows saving, saved, and optional completion-notification examples.

Keyboard movement mirrors the visible controls: `ArrowLeft` moves to the
previous step, `ArrowRight` moves to the next step or finishes on the last
step, and `Escape` closes the tour. Arrow-key movement is ignored when the
event starts in editable controls so text caret movement remains normal.

## Consequences

- The tour matches the product voice and motion system.
- Missing anchors are handled instead of crashing the flow.
- New tour behavior needs component or E2E coverage.
