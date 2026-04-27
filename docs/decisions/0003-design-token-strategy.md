# ADR-0003: v2 Design Token Strategy

## Status

Accepted.

## Context

The rebuilt root app needs a consistent brand system while keeping token usage
centralized.

## Decision

`src/app/theme.css` is the CSS token source for the root app. TypeScript
helpers in `src/v2/design-system/` only reference those token names or
motion presets; components should use token utilities instead of raw
colors.

## Consequences

- Root app styling remains consistent after cutover.
- Components can share a predictable visual language.
- Token additions must be documented in the design-system README.
