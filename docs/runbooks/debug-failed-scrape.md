# Runbook: Debug a Failed Scrape

Use this when the root app cannot parse a truck listing, returns incomplete
data, or fails to discover the listing's performance-check link.

## Steps

1. Reproduce with one listing address against `/api/v2/parse-truck`.
2. Check whether the failure is network, timeout, unsupported address, or
   parser output validation.
3. Add or update an HTML fixture in the parser test before changing
   parsing code.
4. Update `src/v2/shared/lib/parse-truck-html.ts` for selector changes,
   including the optional `성능점검보기` link extraction when needed.
5. If performance-check rendering fails after parsing, inspect
   `/api/v2/checkpaper` and `/api/v2/checkpaper/asset` before changing the
   parser. The save flow may still be successful when only the performance
   check is missing.
6. Keep the API response typed and Korean recovery text non-technical.
7. If the source site changed broadly, register a GitHub issue for wider
   fixture expansion after the immediate fix.

## Checks

- `bun run test -- --run src/v2/shared/lib/__tests__/parse-truck-html.test.ts`
- `bun run test -- --run src/app/api/v2/checkpaper src/v2/features/file-management/__tests__/performance-check-capture.test.ts`
- `bun run test -- --run src/v2/features/truck-processing`
- `bun run typecheck`

## Related Decisions

- `docs/decisions/0002-client-parallel-vs-server-parallel.md`
- `docs/decisions/0004-concurrency-limiter-choice.md`
