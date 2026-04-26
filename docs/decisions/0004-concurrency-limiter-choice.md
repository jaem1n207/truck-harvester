# ADR-0004: Concurrency Limiter Choice

## Status

Accepted.

## Context

The client needs bounded parallel parsing without introducing a heavy data
cache or owning a custom semaphore.

## Decision

Use `p-limit` behind `src/v2/shared/lib/concurrency.ts`, with retry policy
in `src/v2/shared/lib/retry.ts`.

## Consequences

- Default concurrency remains 5.
- Retry behavior is testable independently from scheduling.
- A future tuning change can adjust the default through one shared path and
  a follow-up ADR if needed.
