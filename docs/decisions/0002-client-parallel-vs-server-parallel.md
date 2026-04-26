# ADR-0002: Client Parallelism Over Server Parallelism

## Status

Accepted.

## Context

The deployment target is Vercel Hobby, so each server request must stay
small and predictable. A batch endpoint risks tying all listings to the
slowest request.

## Decision

The browser sends one `POST /api/v2/parse-truck` request per listing
address. The client orchestrates retries, cancellation, and concurrency 5.

## Consequences

- One listing can fail without blocking successful listings.
- The server endpoint stays stateless and parser-focused.
- The client owns progress rendering and retry scheduling.
