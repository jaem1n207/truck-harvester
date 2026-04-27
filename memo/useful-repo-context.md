## Useful repo context (saves re-exploration)

- Existing deps already cover most needs: `zod`, `zustand`, `motion`, `@tanstack/react-form`, `cheerio`, `jszip`, `shadcn@3`, `@vercel/analytics`, `@sentry/nextjs`, `canvas-confetti`.
- Legacy parser logic to extract for v2 reuse: `src/app/api/parse-truck/route.ts` lines 35–188
- Legacy Zod schema is in `src/shared/model/truck.ts` — the `TruckData` shape can be reused; the discriminated-union (success/failed/pending) is the new addition.
- Legacy Zustand store at `src/shared/model/store.ts` is the structural reference for v2's slice (but v2 uses a per-URL state machine, see ADR-006).
- Existing tests (455 LOC, 3 files): `url-validator`, `file-system`, `parse-truck` — patterns to mirror in v2.

## Don't do these (already decided against)

- ❌ Don't edit `src/shared/lib/watermark.ts` or any legacy file (cutover PR territory).
- ❌ Don't pay for Vercel Pro / change hosting.
- ❌ Don't move concurrency to server (3.5s budget kills it).
- ❌ Don't introduce SSE for streaming (per-URL POST is the chosen contract).
- ❌ Don't ship without a first-visit onboarding tour.
- ❌ Don't use react-joyride or driver.js (custom tour decided per ADR-005).
