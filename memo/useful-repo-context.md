## Useful repo context (saves re-exploration)

- The rebuilt app is active at `/`; `/v2` is a compatibility redirect and
  `src/v2/*` is only the internal implementation namespace.
- `src/app/api/v2/parse-truck/route.ts` validates one listing URL, maps timeout
  and unknown failures, and hands successful HTML to the parser.
- `src/app/api/v2/parse-truck/fetch-listing-html.ts` owns source request headers,
  the shared 3.5-second timeout budget, and the hostname-scoped Sectigo R36
  intermediate recovery described by ADR-0006.
- `src/v2/shared/lib/parse-truck-html.ts` is the pure Cheerio parser for listing
  fields, SmartStore manuscript values, images, and performance-check links.
- `src/v2/shared/lib/checkpaper-proxy.ts` owns the allowlisted performance-check
  redirect loop, 4.5-second shared budget, and exact-host Autocafe GoGetSSL
  missing-chain recovery described by ADR-0007.
- `src/v2/entities/url/model.ts` is the source allowlist and required query
  parameter boundary. Keep fetch recovery narrower than or equal to this
  contract.
- Direct regressions live in
  `src/app/api/v2/parse-truck/__tests__/fetch-listing-html.test.ts`,
  `src/app/api/v2/parse-truck/__tests__/route.test.ts`, and
  `src/v2/shared/lib/__tests__/parse-truck-html.test.ts`.
- The operational source of truth is
  `docs/runbooks/debug-failed-scrape.md`; the design rationale and certificate
  lifecycles are in
  `docs/decisions/0006-listing-source-tls-chain-recovery.md` and
  `docs/decisions/0007-autocafe-tls-chain-recovery.md`.

## Don't do these (already decided against)

- ❌ Don't restore the deleted legacy route, legacy runtime folders, or image
  stamping pipeline.
- ❌ Don't pay for Vercel Pro / change hosting.
- ❌ Don't move concurrency to server (3.5s budget kills it).
- ❌ Don't introduce SSE for streaming (per-URL POST is the chosen contract).
- ❌ Don't use react-joyride or driver.js (custom tour decided per ADR-005).
- ❌ Don't disable TLS verification, set a process-global CA override, or
  downgrade listing or performance-check fetches to HTTP. Follow ADR-0006,
  ADR-0007, and the scrape runbook.
