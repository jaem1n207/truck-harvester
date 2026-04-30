# Duration Bucket Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `duration_bucket` event property while preserving the existing numeric `duration_ms` analytics value.

**Architecture:** Keep duration bucket derivation inside the shared analytics payload builder so application workflow code does not need to know Umami property details. `BatchAnalyticsInput.durationMs` remains the single source value; `toBatchEventData()` derives both `duration_ms` and `duration_bucket`.

**Tech Stack:** TypeScript, Vitest, Umami browser tracker wrapper, Next.js app code under `src/v2/shared/lib`.

---

## Scope Check

This plan covers one small analytics payload change. It does not need a
separate dashboard, user identifier, app UI, or workflow restructuring.

## File Structure

- Modify `src/v2/shared/lib/analytics.ts`
  - Add exported `toDurationBucket(durationMs: number)` helper.
  - Add `duration_bucket` to `toBatchEventData()`.
  - Keep `BatchAnalyticsInput` unchanged so callers continue passing only
    `durationMs`.
- Modify `src/v2/shared/lib/__tests__/analytics.test.ts`
  - Add bucket boundary tests.
  - Update existing batch payload expectation.
  - Add a `save_completed` tracking assertion that verifies the bucket reaches
    Umami event data.

## Task 1: Add Duration Bucket Payload

**Files:**

- Modify: `src/v2/shared/lib/analytics.ts`
- Modify: `src/v2/shared/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Write failing tests for bucket conversion and payload output**

In `src/v2/shared/lib/__tests__/analytics.test.ts`, update the import block to include `toDurationBucket` and `trackSaveCompleted`:

```ts
import {
  createAnalyticsBatchId,
  toBatchEventData,
  toDurationBucket,
  toListingFailureEventData,
  toUnsupportedInputFailureInput,
  trackBatchStarted,
  trackListingFailed,
  trackSaveCompleted,
  trackUnsupportedInputFailure,
} from '../analytics'
```

Still in `src/v2/shared/lib/__tests__/analytics.test.ts`, add this test inside `describe('analytics payload builders', () => { ... })` immediately after the batch id test:

```ts
it.each([
  [Number.NaN, '00_under_1s'],
  [Number.POSITIVE_INFINITY, '00_under_1s'],
  [-1, '00_under_1s'],
  [0, '00_under_1s'],
  [999, '00_under_1s'],
  [1000, '01_1s'],
  [1999, '01_1s'],
  [2000, '02_2s'],
  [6420, '06_6s'],
  [9999, '09_9s'],
  [10000, '10_10s_plus'],
  [15320, '10_10s_plus'],
])('maps %s ms to %s', (durationMs, bucket) => {
  expect(toDurationBucket(durationMs)).toBe(bucket)
})
```

Update the existing `builds batch event data with aggregate fields only` expectation in the same file so the expected object includes `duration_bucket`:

```ts
expect(data).toEqual({
  batch_id: 'batch-1',
  url_count: 3,
  unique_url_count: 2,
  ready_count: 1,
  invalid_count: 1,
  preview_failed_count: 0,
  saved_count: 1,
  save_failed_count: 0,
  duration_ms: 1234,
  duration_bucket: '01_1s',
  save_method: 'directory',
  filesystem_supported: true,
  notification_enabled: false,
})
```

Add this test inside `describe('analytics tracking', () => { ... })` after the existing named event data test:

```ts
it('sends duration bucket with save_completed event data', () => {
  const track = vi.fn()
  stubWindow({ umami: { track } })

  trackSaveCompleted({
    batchId: 'batch-1',
    urlCount: 4,
    uniqueUrlCount: 4,
    readyCount: 4,
    invalidCount: 0,
    previewFailedCount: 0,
    savedCount: 4,
    saveFailedCount: 0,
    durationMs: 6420,
    saveMethod: 'directory',
    filesystemSupported: true,
    notificationEnabled: false,
  })

  expect(track).toHaveBeenCalledWith('save_completed', {
    batch_id: 'batch-1',
    url_count: 4,
    unique_url_count: 4,
    ready_count: 4,
    invalid_count: 0,
    preview_failed_count: 0,
    saved_count: 4,
    save_failed_count: 0,
    duration_ms: 6420,
    duration_bucket: '06_6s',
    save_method: 'directory',
    filesystem_supported: true,
    notification_enabled: false,
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: FAIL because `toDurationBucket` is not exported and `duration_bucket` is not in the payload yet.

- [ ] **Step 3: Implement the duration bucket helper and payload field**

In `src/v2/shared/lib/analytics.ts`, add this helper after `createAnalyticsBatchId()`:

```ts
export function toDurationBucket(durationMs: number) {
  const normalizedDurationMs = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0

  if (normalizedDurationMs < 1000) {
    return '00_under_1s'
  }

  const seconds = Math.floor(normalizedDurationMs / 1000)

  if (seconds >= 10) {
    return '10_10s_plus'
  }

  const paddedSeconds = seconds.toString().padStart(2, '0')

  return `${paddedSeconds}_${seconds}s`
}
```

Then update `toBatchEventData()` in the same file so it derives the new field from `input.durationMs`:

```ts
export function toBatchEventData(input: BatchAnalyticsInput) {
  return compactEventData({
    batch_id: input.batchId,
    url_count: input.urlCount,
    unique_url_count: input.uniqueUrlCount,
    ready_count: input.readyCount,
    invalid_count: input.invalidCount,
    preview_failed_count: input.previewFailedCount,
    saved_count: input.savedCount,
    save_failed_count: input.saveFailedCount,
    duration_ms: input.durationMs,
    duration_bucket: toDurationBucket(input.durationMs),
    save_method: input.saveMethod,
    filesystem_supported: input.filesystemSupported,
    notification_enabled: input.notificationEnabled,
  })
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: PASS. The analytics test file should report all tests passing.

- [ ] **Step 5: Run typecheck and format check**

Run:

```bash
bun run typecheck
bun run format:check
```

Expected: both commands complete successfully.

- [ ] **Step 6: Commit the implementation**

Run:

```bash
git add src/v2/shared/lib/analytics.ts src/v2/shared/lib/__tests__/analytics.test.ts
git commit -m "feat: duration bucket 분석 속성 추가"
```

Expected: one commit containing the analytics helper, payload field, and tests.

## Task 2: Final Verification

**Files:**

- Read: `docs/superpowers/specs/2026-04-30-duration-bucket-analytics-design.md`
- Read: `src/v2/shared/lib/analytics.ts`
- Read: `src/v2/shared/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Run the full finite test command**

Run:

```bash
bun run test -- --run
```

Expected: PASS. Use `--run` so Vitest exits instead of entering watch mode.

- [ ] **Step 2: Run lint**

Run:

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 3: Confirm the emitted payload shape manually**

Check `src/v2/shared/lib/analytics.ts` and confirm `toBatchEventData()` still includes all previous aggregate fields and now includes exactly one new bucket field:

```ts
duration_ms: input.durationMs,
duration_bucket: toDurationBucket(input.durationMs),
```

Confirm no success listing identifiers were added to batch payloads:

```ts
expect(data).not.toHaveProperty('listing_url')
expect(data).not.toHaveProperty('vehicle_number')
expect(data).not.toHaveProperty('vehicle_name')
```

- [ ] **Step 4: Confirm git status is clean**

Run:

```bash
git status --short
```

Expected: no output.

## Self-Review Notes

- Spec coverage: The plan preserves `duration_ms`, adds `duration_bucket`, covers boundary values, verifies `save_completed`, and keeps user-identifying success listing fields out of batch payloads.
- Scope check: No UI, dashboard, user identity, self-hosting, or image-level timing work is included.
- Type consistency: The helper name is `toDurationBucket`; the event property name is `duration_bucket`; callers continue to use `durationMs`.
