# ADR-0005: Onboarding Tour Strategy

## Status

Accepted.

## Context

First-time staff should understand the `/v2` flow without external
training. Third-party tour libraries would add style drift and extra
weight.

## Decision

Build a custom onboarding tour using the existing `/v2` UI primitives and
Motion presets. Each step uses a stable anchor and a safe fallback when the
anchor is missing.

## Consequences

- The tour matches the product voice and motion system.
- Missing anchors are handled instead of crashing the flow.
- New tour behavior needs component or E2E coverage.
