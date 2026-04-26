# v2 Design System

> Source of truth for `/v2` colors, motion, radius, and elevation.

## Brand voice

The product feels like a **calm, fast tool** — never a flashy demo. Five
adjectives the visual choices answer to:

1. **이슈 제로** — interactions are clean and recoverable; no dead-ends.
2. **빠른 서비스** — perceived speed is part of the brand. Long durations
   are reserved for celebration moments.
3. **살아있는 유기체** — motion is springy and natural, not linear-mechanical.
4. **규칙적 그리드** — spacing is always a multiple of 4. No "off-by-1px"
   adjustments allowed in finished components.
5. **진행 표시 = 시그니처 딜라이트** — progress indicators are where we earn
   emotional connection. Spend animation budget here.

Accessibility is a brand attribute. Reduced motion is respected
everywhere; AA contrast is not negotiable.

## Token rules

1. **Single source of truth.** Every color, radius, duration, and easing
   originates in `src/app/v2/theme.css`. The TS module re-exports the
   `var(...)` strings for non-Tailwind contexts.
2. **Tailwind utility first.** Reach for `bg-primary text-foreground rounded-md`
   before considering inline styles.
3. **No raw hex / no raw oklch in components.** If you find yourself writing
   `style={{ color: '#e76f51' }}` in a `.tsx` file, stop and add a token
   instead. Lint enforcement lands in P9; treat it as enforced today.
4. **Spacing is Tailwind's default scale (4 / 8 / 16 / 24 ...).** Do not
   introduce a custom `--space-*` scale unless the design demands it.

## When to use which color

| Token                                            | Use for                                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `bg-background` / `text-foreground`              | Page surface and primary body text.                                                                       |
| `bg-card` / `text-card-foreground`               | Elevated content blocks (truck cards, dialogs).                                                           |
| `bg-primary` / `text-primary-foreground`         | Single most important action per view (submit, retry batch). At most **one** primary on screen at a time. |
| `bg-secondary` / `text-secondary-foreground`     | Supporting actions where primary already exists.                                                          |
| `bg-muted` / `text-muted-foreground`             | Caption copy, helper text, dim chrome.                                                                    |
| `bg-accent` / `text-accent-foreground`           | Hover halos, soft highlight, gentle attention.                                                            |
| `bg-destructive` / `text-destructive-foreground` | Irreversible actions (delete, force-cancel). Never just "error message".                                  |
| `border-border`                                  | Default borders.                                                                                          |
| `ring-ring`                                      | Focus rings. Always visible — never hidden.                                                               |

## When to use which easing

| Token                  | Use for                                                  |
| ---------------------- | -------------------------------------------------------- |
| `--ease-out-soft`      | Most state changes — fades, slides, opacity.             |
| `--ease-spring-snappy` | Item enter (scale 0.96 → 1), confident pop on success.   |
| `--ease-spring-soft`   | Drag/drop, gesture follow-through, interactive feedback. |

## Reduced-motion behavior

Honor `prefers-reduced-motion: reduce` at the component level. The global
CSS in `src/app/globals.css` already shortens animations to 0.01ms via
media query, but **do not rely solely on that**. Components that animate
with Motion/React must use the `useReducedMotion` hook from Motion (or our
project wrapper from P7) and substitute opacity-only fades or skip motion
entirely when reduced motion is requested.
