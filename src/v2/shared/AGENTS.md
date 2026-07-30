# src/v2/shared AGENTS.md

`src/v2/shared` contains reusable primitives that are safe for multiple
features and widgets to import. Keep this layer free of deleted legacy
shared-folder dependencies and image-stamping code.

## Segments

- `lib/`: shared utilities such as HTML parsing, retry, concurrency, and the
  server-only CheckPaper redirect/TLS proxy helper.
- `model/`: cross-feature Zustand vanilla stores and selectors.
- `ui/`: low-level UI primitives styled with root app tokens from `src/app/theme.css`.

## State Rules

- Model state uses discriminated unions. Components and features must
  transition items through exported store actions instead of mutating item
  status fields directly.
- Use selectors for derived groups such as checking, ready, saving, and
  saved so widgets share one completion rule.
- Browser persistence must be injected or guarded for SSR. Do not read
  `localStorage` during module initialization.
- User-facing copy remains Korean-only and recovery-oriented.
- `checkpaper-proxy.ts` is imported only by Node route handlers. Build outbound
  targets from server-owned literal origins, independently encode path/query
  components, reject credentials/fragments/explicit ports, keep host-specific
  path policies closed, and apply the same checks to initial URLs and redirects.
- Keep TLS verification enabled and Autocafe certificate recovery restricted to
  exact host plus known missing-chain errors.

## Public API

Export shared model helpers through `src/v2/shared/model/index.ts`.
Add a colocated test before adding or changing store actions.

## Knowledge Links

- Shared state in the flow: `docs/architecture.md`
- CheckPaper TLS decision:
  `docs/decisions/0007-autocafe-tls-chain-recovery.md`
- Token changes: `docs/runbooks/add-design-token.md`
- Relevant decisions: `docs/decisions/0003-design-token-strategy.md`,
  `docs/decisions/0004-concurrency-limiter-choice.md`
