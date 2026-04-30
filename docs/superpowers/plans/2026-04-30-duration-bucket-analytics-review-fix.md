# Duration Bucket Analytics Review Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `duration_bucket` scoped to `save_completed` and make `duration_ms` use the same normalized duration value as the bucket.

**Architecture:** `toBatchEventData()` remains the shared aggregate batch payload builder and stops emitting `duration_bucket`. `trackSaveCompleted()` becomes the only save-completed-specific analytics path that adds the derived bucket. A private `normalizeDurationMs()` helper guards the analytics transport boundary so every batch event emits a finite, non-negative integer `duration_ms`.

**Tech Stack:** TypeScript, Vitest, Umami browser tracker wrapper, Next.js app code under `src/v2/shared/lib`.

---

## Scope Check

This plan covers one focused analytics transport correction. It does not add new
events, dashboards, user identifiers, app UI, or workflow-level tracking logic.

## File Structure

- Modify `src/v2/shared/lib/analytics.ts`
  - Add private `normalizeDurationMs(durationMs: number)` near the analytics
    helper constants.
  - Update `toDurationBucket()` to derive buckets from `normalizeDurationMs()`.
  - Update `toBatchEventData()` to emit normalized `duration_ms` and stop
    emitting `duration_bucket`.
  - Update `trackSaveCompleted()` to add `duration_bucket` to the
    save-completed payload only.
- Modify `src/v2/shared/lib/__tests__/analytics.test.ts`
  - Update the aggregate batch payload expectation so `duration_bucket` is
    absent from the shared builder.
  - Add duration normalization tests for `toBatchEventData()`.
  - Add a non-save batch event tracking assertion that verifies
    `duration_bucket` is not sent.
  - Update the save-completed tracking assertion to verify normalized
    `duration_ms` and `duration_bucket` are sent together.

## Task 1: Lock The Analytics Payload Contract With Failing Tests

**Files:**

- Modify: `src/v2/shared/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Update the analytics import block**

In `src/v2/shared/lib/__tests__/analytics.test.ts`, keep the existing import list
and make sure `trackBatchStarted` and `trackSaveCompleted` are imported:

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

Expected: this is already true in the current file, so this step is a quick
confirmation before editing assertions.

- [ ] **Step 2: Change the shared batch payload expectation**

In the `builds batch event data with aggregate fields only` test, remove
`duration_bucket` from the expected object and add an explicit absence assertion:

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
  save_method: 'directory',
  filesystem_supported: true,
  notification_enabled: false,
})
expect(data).not.toHaveProperty('duration_bucket')
expect(data).not.toHaveProperty('listing_url')
expect(data).not.toHaveProperty('vehicle_number')
expect(data).not.toHaveProperty('vehicle_name')
```

- [ ] **Step 3: Add duration normalization tests for the shared builder**

Still inside `describe('analytics payload builders', () => { ... })`, add this
test immediately after `builds batch event data with aggregate fields only`:

```ts
it.each([
  [Number.NaN, 0],
  [Number.POSITIVE_INFINITY, 0],
  [Number.NEGATIVE_INFINITY, 0],
  [-1, 0],
  [0, 0],
  [999.9, 999],
  [1000.7, 1000],
])('normalizes %s ms to duration_ms %s', (durationMs, expectedDurationMs) => {
  const data = toBatchEventData({
    batchId: 'batch-normalized',
    urlCount: 1,
    uniqueUrlCount: 1,
    readyCount: 1,
    invalidCount: 0,
    previewFailedCount: 0,
    savedCount: 1,
    saveFailedCount: 0,
    durationMs,
    filesystemSupported: true,
    notificationEnabled: false,
  })

  expect(data).toMatchObject({
    duration_ms: expectedDurationMs,
  })
})
```

- [ ] **Step 4: Add a non-save event assertion**

Inside `describe('analytics tracking', () => { ... })`, add this test after
`does nothing when the Umami tracker is missing`:

```ts
it('does not send duration bucket with batch_started event data', () => {
  const track = vi.fn()
  stubWindow({ umami: { track } })

  trackBatchStarted({
    batchId: 'batch-started',
    urlCount: 2,
    uniqueUrlCount: 2,
    readyCount: 0,
    invalidCount: 0,
    previewFailedCount: 0,
    savedCount: 0,
    saveFailedCount: 0,
    durationMs: Number.NaN,
    filesystemSupported: true,
    notificationEnabled: false,
  })

  expect(track).toHaveBeenCalledWith('batch_started', {
    batch_id: 'batch-started',
    url_count: 2,
    unique_url_count: 2,
    ready_count: 0,
    invalid_count: 0,
    preview_failed_count: 0,
    saved_count: 0,
    save_failed_count: 0,
    duration_ms: 0,
    filesystem_supported: true,
    notification_enabled: false,
  })
})
```

- [ ] **Step 5: Update save-completed tracking to verify normalization**

In the existing `sends duration bucket with save_completed event data` test,
change `durationMs` from `6420` to `6420.9`, and change the expected
`duration_ms` from `6420` to `6420` while keeping the same bucket:

```ts
trackSaveCompleted({
  batchId: 'batch-1',
  urlCount: 4,
  uniqueUrlCount: 4,
  readyCount: 4,
  invalidCount: 0,
  previewFailedCount: 0,
  savedCount: 4,
  saveFailedCount: 0,
  durationMs: 6420.9,
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
```

- [ ] **Step 6: Run the focused test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: FAIL. The shared builder still emits `duration_bucket`, `duration_ms`
is not normalized in `toBatchEventData()`, and `batch_started` still includes a
bucket.

## Task 2: Implement Save-Completed-Only Bucket Emission

**Files:**

- Modify: `src/v2/shared/lib/analytics.ts`

- [ ] **Step 1: Add the private duration normalizer**

In `src/v2/shared/lib/analytics.ts`, add this helper after
`compactEventData` and before `trackEvent`:

```ts
const normalizeDurationMs = (durationMs: number) => {
  if (!Number.isFinite(durationMs)) {
    return 0
  }

  return Math.max(0, Math.floor(durationMs))
}
```

- [ ] **Step 2: Update `toDurationBucket()` to share the normalizer**

Replace the first lines of `toDurationBucket()` with this implementation:

```ts
export function toDurationBucket(durationMs: number) {
  const normalizedDurationMs = normalizeDurationMs(durationMs)

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

- [ ] **Step 3: Update the shared batch payload builder**

Replace `toBatchEventData()` with this version:

```ts
export function toBatchEventData(input: BatchAnalyticsInput) {
  const durationMs = normalizeDurationMs(input.durationMs)

  return compactEventData({
    batch_id: input.batchId,
    url_count: input.urlCount,
    unique_url_count: input.uniqueUrlCount,
    ready_count: input.readyCount,
    invalid_count: input.invalidCount,
    preview_failed_count: input.previewFailedCount,
    saved_count: input.savedCount,
    save_failed_count: input.saveFailedCount,
    duration_ms: durationMs,
    save_method: input.saveMethod,
    filesystem_supported: input.filesystemSupported,
    notification_enabled: input.notificationEnabled,
  })
}
```

- [ ] **Step 4: Add the bucket only inside `trackSaveCompleted()`**

Replace the current `trackSaveCompleted()` export with this version:

```ts
export const trackSaveCompleted = (input: BatchAnalyticsInput) => {
  const durationMs = normalizeDurationMs(input.durationMs)

  trackEvent('save_completed', {
    ...toBatchEventData({
      ...input,
      durationMs,
    }),
    duration_bucket: toDurationBucket(durationMs),
  })
}
```

Expected: `trackSaveCompleted()` is now the only batch tracker that emits
`duration_bucket`.

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: PASS. The analytics test file should report all tests passing.

- [ ] **Step 6: Commit the implementation**

Run:

```bash
git add src/v2/shared/lib/analytics.ts src/v2/shared/lib/__tests__/analytics.test.ts
git commit -m "fix: duration bucket 전송 범위 보정"
```

Expected: one commit containing only the analytics implementation and tests.

## Task 3: Final Verification

**Files:**

- Read: `docs/superpowers/specs/2026-04-30-duration-bucket-analytics-review-fix-design.md`
- Read: `src/v2/shared/lib/analytics.ts`
- Read: `src/v2/shared/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Run the full finite test command**

Run:

```bash
bun run test -- --run
```

Expected: PASS. Use `--run` so Vitest exits instead of entering watch mode.

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 4: Run format check**

Run:

```bash
bun run format:check
```

Expected: PASS.

- [ ] **Step 5: Confirm the emitted payload shape manually**

Check `src/v2/shared/lib/analytics.ts` and confirm:

```ts
export function toBatchEventData(input: BatchAnalyticsInput) {
  const durationMs = normalizeDurationMs(input.durationMs)

  return compactEventData({
    duration_ms: durationMs,
  })
}
```

Also confirm `trackSaveCompleted()` is the only batch event wrapper that adds:

```ts
duration_bucket: toDurationBucket(durationMs),
```

- [ ] **Step 6: Confirm git status is clean**

Run:

```bash
git status --short
```

Expected: no output.

## Self-Review Notes

- Spec coverage: Task 1 locks the two review findings with failing tests. Task 2
  scopes bucket emission to `save_completed` and shares one normalized duration
  value. Task 3 verifies the whole repo-facing test/check surface.
- Placeholder scan: The plan contains no placeholder or fill-in steps. Code
  steps include concrete snippets and exact commands.
- Type consistency: The plan uses the existing `BatchAnalyticsInput`,
  `toBatchEventData()`, `toDurationBucket()`, `trackBatchStarted()`, and
  `trackSaveCompleted()` names. The only new helper is private
  `normalizeDurationMs()`.
