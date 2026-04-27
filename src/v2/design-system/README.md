# v2 Design System

`src/app/theme.css` is the single source of truth for root app color,
radius, and motion tokens. Components should use Tailwind token utilities
such as `bg-background`, `text-foreground`, `border-border`, and
`rounded-lg` instead of raw color or spacing values.

## Colors

- `primary`: the one main action on the screen, usually "새 작업 시작" or
  retrying a failed item.
- `secondary`: supporting actions when a primary action is already visible.
- `muted`: helper text, captions, quiet surfaces, and inactive progress.
- `accent`: soft attention without blocking the user's current work.
- `destructive`: irreversible or forceful actions only.
- `success` / `warning`: root app semantic tokens for progress and attention
  states. Use through `v2ColorTokens` when Tailwind utility names are not
  enough.

## Radius

Default interactive controls use `rounded-lg`. Repeated cards can use
`rounded-xl`. Avoid larger radii unless a full-screen onboarding or
celebration surface needs a softer feel.

## Motion

Use `--duration-micro` for small hover/focus feedback, `--duration-quick`
for item entry, `--duration-standard` for step transitions, and
`--duration-slow` only for progress shimmer or completion moments. All
Motion/React components must honor reduced motion.

`src/v2/design-system/motion.ts` is the TypeScript motion source for
Motion/React components. Use named presets through
`useV2MotionPreset()` instead of hardcoding `initial`, `animate`, or
`transition` props inside widgets. This keeps the reduced-motion rule in
one place: when motion is reduced, presets remove transform/transition
work and render the final state immediately.

- `itemEnter`: list item enter/exit surfaces such as entered addresses.
- `stepTransition`: page or onboarding step changes.
- `streamPop`: streamed result cards as each truck updates.
- `shimmer`: long-running progress affordances; apply only after a real
  progress surface exists.
