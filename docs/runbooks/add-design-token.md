# Runbook: Add a v2 Design Token

Use this when a `/v2` component needs a new color, spacing, radius, or
motion token.

## Steps

1. Confirm an existing token in `src/app/theme.css` or
   `src/v2/design-system/motion.ts` cannot express the need.
2. Add the CSS custom property or motion preset at the design-system
   source.
3. Update `src/v2/design-system/tokens.ts` if TypeScript consumers need
   the token name.
4. Document intent in `src/v2/design-system/README.md`.
5. Replace component literals with token utilities or named presets.
6. Add a focused test when token exports or reduced-motion behavior
   changes.

## Checks

- `bun run test -- --run src/v2/design-system`
- `bun run lint`
- `bun run format:check`

## Related Decisions

- `docs/decisions/0003-design-token-strategy.md`
