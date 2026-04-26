# ADR-0003: v2 Design Token Strategy

## Status

Accepted.

## Context

The rebuild needs a consistent brand system without leaking `/v2` styling
into the legacy root route.

## Decision

`src/app/v2/theme.css` is the CSS token source for `/v2`. TypeScript
helpers in `src/v2/design-system/` only reference those token names or
motion presets; components should use token utilities instead of raw
colors.

## Consequences

- Legacy global UI remains isolated.
- Components can share a predictable visual language.
- Token additions must be documented in the design-system README.
