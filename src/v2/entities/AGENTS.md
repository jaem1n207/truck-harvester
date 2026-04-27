# src/v2/entities AGENTS.md

Entities are pure domain contracts. They may import Zod and other entity
types, but they must not import React, browser APIs, Zustand stores, route
handlers, or UI components.

## Current Slices

- `truck/`: truck listing data and parse-result states.
- `url/`: supported truck listing address normalization and validation.
- `download/`: per-truck download progress states.

## Rules

- Keep schemas and exported TypeScript types in the same slice.
- Use discriminated unions for user-visible state machines.
- Keep visible error text Korean and non-technical.
- Add tests beside the slice whenever a schema or transition shape changes.

## Knowledge Links

- Entity position in the flow: `docs/architecture.md`
- Failed scrape debugging context: `docs/runbooks/debug-failed-scrape.md`
- Relevant decisions: `docs/decisions/0002-client-parallel-vs-server-parallel.md`
