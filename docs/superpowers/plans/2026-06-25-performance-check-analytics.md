# Performance Check Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add aggregate performance-check save counts to existing batch save analytics without treating missing performance-check records as vehicle save failures.

**Architecture:** Keep the existing boundary: save workflow emits business facts, workflow analytics converts them into batch analytics input, and shared analytics is the only layer that knows Umami payload keys. Save results are threaded by prepared listing id so the adapter can count requested, saved, missing, and image totals per original preview batch. No raw CheckPaper URL, document bytes, or per-vehicle performance-check URL leaves the save flow.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Vitest, Zustand vanilla stores, existing Umami wrapper in `src/v2/shared/lib/analytics.ts`.

---

## File Structure

- Modify `src/v2/shared/lib/analytics.ts`: Extend `BatchAnalyticsInput` and `toBatchEventData()` with optional performance-check aggregate fields.
- Modify `src/v2/shared/lib/__tests__/analytics.test.ts`: Lock the shared payload contract and `save_completed` payload shape.
- Modify `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`: Extend `saveSettled` facts with save results and compute performance-check aggregates per save batch group.
- Modify `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`: Verify `saved`, `missing`, and `not_requested` stay distinct and do not create listing failure events.
- Modify `src/v2/application/truck-harvester-workflow/save-workflow.ts`: Collect `TruckSaveResult` values by prepared listing id for directory and ZIP paths.
- Modify `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`: Verify directory and ZIP save results are passed into `saveSettled`.

---

### Task 1: Extend Shared Analytics Payload Contract

**Files:**

- Modify: `src/v2/shared/lib/analytics.ts`
- Test: `src/v2/shared/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Write the failing payload builder test**

In `src/v2/shared/lib/__tests__/analytics.test.ts`, add this test inside `describe('analytics payload builders', () => { ... })` after the existing `builds batch event data with aggregate fields only` test:

```ts
it('builds batch event data with performance-check aggregates only as counts', () => {
  const data = toBatchEventData({
    batchId: 'batch-performance-checks',
    urlCount: 4,
    uniqueUrlCount: 4,
    readyCount: 4,
    invalidCount: 0,
    previewFailedCount: 0,
    savedCount: 4,
    saveFailedCount: 0,
    durationMs: 2400,
    saveMethod: 'zip',
    filesystemSupported: false,
    notificationEnabled: true,
    performanceCheckRequestedCount: 3,
    performanceCheckSavedCount: 2,
    performanceCheckMissingCount: 1,
    performanceCheckImageCount: 5,
  })

  expect(data).toEqual({
    batch_id: 'batch-performance-checks',
    url_count: 4,
    unique_url_count: 4,
    ready_count: 4,
    invalid_count: 0,
    preview_failed_count: 0,
    saved_count: 4,
    save_failed_count: 0,
    duration_ms: 2400,
    save_method: 'zip',
    filesystem_supported: false,
    notification_enabled: true,
    performance_check_requested_count: 3,
    performance_check_saved_count: 2,
    performance_check_missing_count: 1,
    performance_check_image_count: 5,
  })
  expect(data).not.toHaveProperty('listing_url')
  expect(data).not.toHaveProperty('vehicle_number')
  expect(data).not.toHaveProperty('vehicle_name')
  expect(data).not.toHaveProperty('performance_check_url')
  expect(data).not.toHaveProperty('checkpaper_url')
})
```

- [ ] **Step 2: Write the failing tracking test**

In the existing `sends duration bucket with save_completed event data` test, add these fields to the `trackSaveCompleted({ ... })` input:

```ts
      performanceCheckRequestedCount: 3,
      performanceCheckSavedCount: 2,
      performanceCheckMissingCount: 1,
      performanceCheckImageCount: 4,
```

Then add these expected fields to the `expect(track).toHaveBeenCalledWith('save_completed', { ... })` payload:

```ts
      performance_check_requested_count: 3,
      performance_check_saved_count: 2,
      performance_check_missing_count: 1,
      performance_check_image_count: 4,
```

- [ ] **Step 3: Run the focused analytics test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: FAIL with TypeScript or assertion output showing the new `performanceCheck*` input fields are not part of `BatchAnalyticsInput` or are missing from payload output.

- [ ] **Step 4: Extend `BatchAnalyticsInput`**

In `src/v2/shared/lib/analytics.ts`, add these optional fields to `BatchAnalyticsInput` after `saveFailedCount`:

```ts
  performanceCheckRequestedCount?: number
  performanceCheckSavedCount?: number
  performanceCheckMissingCount?: number
  performanceCheckImageCount?: number
```

- [ ] **Step 5: Emit compact Umami keys from `toBatchEventData()`**

In `src/v2/shared/lib/analytics.ts`, add these entries inside the object passed to `compactEventData()` in `toBatchEventData()` after `save_failed_count`:

```ts
    performance_check_requested_count: input.performanceCheckRequestedCount,
    performance_check_saved_count: input.performanceCheckSavedCount,
    performance_check_missing_count: input.performanceCheckMissingCount,
    performance_check_image_count: input.performanceCheckImageCount,
```

- [ ] **Step 6: Run the focused analytics test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: PASS. The shared transport accepts aggregate count fields and still omits per-listing identifiers from batch payloads.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/v2/shared/lib/analytics.ts src/v2/shared/lib/__tests__/analytics.test.ts
git commit -m "feat: 성능점검 analytics payload 확장"
```

---

### Task 2: Thread Save Results Through The Workflow Boundary

**Files:**

- Modify: `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`
- Modify: `src/v2/application/truck-harvester-workflow/save-workflow.ts`
- Test: `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`
- Test: `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`

- [ ] **Step 1: Extend the `saveSettled` fact type**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`, update the imports to include `TruckSaveResult`:

```ts
import { type TruckSaveResult } from '@/v2/features/file-management'
```

Then update the `WorkflowTracker.saveSettled` event type from:

```ts
  saveSettled: (event: {
    items: readonly WorkflowSaveItem[]
    saveMethod: SaveMethod
    savedItemIds: ReadonlySet<string>
  }) => void
```

to:

```ts
  saveSettled: (event: {
    items: readonly WorkflowSaveItem[]
    saveMethod: SaveMethod
    savedItemIds: ReadonlySet<string>
    saveResultsByItemId: ReadonlyMap<string, TruckSaveResult>
  }) => void
```

Leave the current `createWorkflowAnalytics().saveSettled` implementation destructuring as `({ items, saveMethod, savedItemIds })` in this task. TypeScript allows callers to provide the extra field while the implementation ignores it until Task 3.

- [ ] **Step 2: Update existing workflow analytics test calls**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`, update each existing `tracker.saveSettled({ ... })` call that does not yet test performance-check aggregates by adding:

```ts
      saveResultsByItemId: new Map(),
```

For the existing successful retry call that saves `item.id`, use an empty map in this task:

```ts
tracker.saveSettled({
  items: [item],
  saveMethod: 'directory',
  savedItemIds: new Set([item.id]),
  saveResultsByItemId: new Map(),
})
```

- [ ] **Step 3: Update save workflow tests to expect save result maps**

In `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`, update the first directory success expectation to include the result map:

```ts
expect(tracker.saveSettled).toHaveBeenCalledWith({
  items: [workflowItem],
  saveMethod: 'directory',
  savedItemIds: new Set(['listing-1']),
  saveResultsByItemId: new Map([['listing-1', directorySaveResult]]),
})
```

Update the directory failure expectation to include an empty map:

```ts
expect(tracker.saveSettled).toHaveBeenCalledWith({
  items: [workflowItem],
  saveMethod: 'directory',
  savedItemIds: new Set(),
  saveResultsByItemId: new Map(),
})
```

In the `preserves ZIP save results on matching saved items` test, replace the inline ZIP result array with named constants before `downloadTruckZip`:

```ts
const secondZipSaveResult = {
  performanceCheckImageCount: 0,
  performanceCheckStatus: 'saved',
  sourceUrl: secondUrl,
  vehicleImageCount: 0,
  vehicleImageStatus: 'complete',
  vehicleImageTotalCount: 0,
  vehicleFolderName: '부산34나7890',
  vehicleNumber: '부산34나7890',
} satisfies TruckSaveResult
const firstZipSaveResult = missingPerformanceCheckResult
const downloadTruckZip = vi.fn(async () => [secondZipSaveResult, firstZipSaveResult])
```

Then add this assertion at the end of that test:

```ts
expect(tracker.saveSettled).toHaveBeenCalledWith({
  items: [
    {
      id: 'listing-1',
      url: firstUrl,
      listing,
    },
    {
      id: 'listing-2',
      url: secondUrl,
      listing: secondListing,
    },
  ],
  saveMethod: 'zip',
  savedItemIds: new Set(['listing-1', 'listing-2']),
  saveResultsByItemId: new Map([
    ['listing-1', firstZipSaveResult],
    ['listing-2', secondZipSaveResult],
  ]),
})
```

In the `does not attach mismatched ZIP results to the wrong saved item` test, add this assertion after the existing `tracker.saveListingFailed` expectation:

```ts
expect(tracker.saveSettled).toHaveBeenCalledWith({
  items: [
    {
      id: 'listing-1',
      url: firstUrl,
      listing,
    },
    {
      id: 'listing-2',
      url: secondUrl,
      listing: secondListing,
    },
  ],
  saveMethod: 'zip',
  savedItemIds: new Set(['listing-1']),
  saveResultsByItemId: new Map([
    [
      'listing-1',
      {
        ...missingPerformanceCheckResult,
        sourceUrl: firstUrl,
      },
    ],
  ]),
})
```

- [ ] **Step 4: Run the focused save workflow test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/save-workflow.test.ts
```

Expected: FAIL because `saveSettled` calls do not yet include `saveResultsByItemId`.

- [ ] **Step 5: Collect directory and ZIP save results by prepared listing id**

In `src/v2/application/truck-harvester-workflow/save-workflow.ts`, add the map beside `savedItemIds`:

```ts
const savedItemIds = new Set<string>()
const saveResultsByItemId = new Map<string, TruckSaveResult>()
```

In the directory save path, after `saveTruckToDirectory(...)` resolves and before `store.getState().markSaved(item.id, saveResult)`, add:

```ts
saveResultsByItemId.set(item.id, saveResult)
```

In the ZIP matched result path, after the `if (!saveResult) { ... return }` block and before `store.getState().markSaved(item.id, saveResult)`, add:

```ts
saveResultsByItemId.set(item.id, saveResult)
```

Update the final `tracker.saveSettled({ ... })` call to include:

```ts
    saveResultsByItemId,
```

The final call should be:

```ts
tracker.saveSettled({
  items: workflowItems,
  saveMethod,
  savedItemIds,
  saveResultsByItemId,
})
```

- [ ] **Step 6: Run focused workflow tests and verify they pass**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/save-workflow.test.ts src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts
```

Expected: PASS. The save workflow passes result maps, and the analytics adapter still behaves as before because it ignores the map until Task 3.

- [ ] **Step 7: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS. All `WorkflowTracker.saveSettled` callers include `saveResultsByItemId`.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add src/v2/application/truck-harvester-workflow/workflow-analytics.ts src/v2/application/truck-harvester-workflow/save-workflow.ts src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts src/v2/application/truck-harvester-workflow/save-workflow.test.ts
git commit -m "feat: 저장 결과를 workflow analytics에 전달"
```

---

### Task 3: Compute Performance-Check Aggregates In Workflow Analytics

**Files:**

- Modify: `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`
- Test: `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`

- [ ] **Step 1: Add workflow analytics test fixtures**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`, update the imports to include `TruckSaveResult`:

```ts
import { type TruckSaveResult } from '@/v2/features/file-management'
```

After the existing `listing` fixture, add this helper:

```ts
const createSaveResult = (overrides: Partial<TruckSaveResult> = {}): TruckSaveResult => ({
  performanceCheckImageCount: 0,
  performanceCheckStatus: 'not_requested',
  sourceUrl: firstUrl,
  vehicleImageCount: 1,
  vehicleImageStatus: 'complete',
  vehicleImageTotalCount: 1,
  vehicleFolderName: '서울12가3456',
  vehicleNumber: '서울12가3456',
  ...overrides,
})
```

- [ ] **Step 2: Write the failing aggregate success test**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`, add this test inside `describe('workflow analytics adapter', () => { ... })` after the existing `tracks save batches separately by original preview batch` test:

```ts
it('adds performance-check aggregates to save completed events without listing failures for missing records', () => {
  const transport = createTransport()
  const tracker = createWorkflowAnalytics({
    createBatchId: () => 'batch-performance-checks',
    getFilesystemSupported: () => true,
    getNotificationEnabled: () => false,
    now: () => 300,
    transport,
  })
  const batch = tracker.previewStarted({ urlCount: 3, startedAt: 100 })
  const savedCheckListing = {
    ...listing,
    performanceCheckUrl: 'https://check.example.com/saved',
  }
  const missingCheckListing = {
    ...listing,
    url: secondUrl,
    vnumber: '부산34나7890',
    performanceCheckUrl: 'https://check.example.com/missing',
  }
  const notRequestedListing = {
    ...listing,
    url: thirdUrl,
    vnumber: '대구56다1234',
    performanceCheckUrl: undefined,
  }

  tracker.previewCompleted({
    batch,
    items: [
      { id: 'listing-1', url: firstUrl, status: 'ready' },
      { id: 'listing-2', url: secondUrl, status: 'ready' },
      { id: 'listing-3', url: thirdUrl, status: 'ready' },
    ],
  })
  tracker.saveSettled({
    items: [
      { id: 'listing-1', url: firstUrl, listing: savedCheckListing },
      { id: 'listing-2', url: secondUrl, listing: missingCheckListing },
      { id: 'listing-3', url: thirdUrl, listing: notRequestedListing },
    ],
    saveMethod: 'directory',
    savedItemIds: new Set(['listing-1', 'listing-2', 'listing-3']),
    saveResultsByItemId: new Map([
      [
        'listing-1',
        createSaveResult({
          performanceCheckImageCount: 2,
          performanceCheckStatus: 'saved',
          sourceUrl: firstUrl,
        }),
      ],
      [
        'listing-2',
        createSaveResult({
          performanceCheckImageCount: 0,
          performanceCheckStatus: 'missing',
          sourceUrl: secondUrl,
          vehicleFolderName: '부산34나7890',
          vehicleNumber: '부산34나7890',
        }),
      ],
      [
        'listing-3',
        createSaveResult({
          performanceCheckImageCount: 0,
          performanceCheckStatus: 'not_requested',
          sourceUrl: thirdUrl,
          vehicleFolderName: '대구56다1234',
          vehicleNumber: '대구56다1234',
        }),
      ],
    ]),
  })

  expect(transport.trackSaveCompleted).toHaveBeenCalledWith(
    expect.objectContaining({
      batchId: 'batch-performance-checks',
      savedCount: 3,
      saveFailedCount: 0,
      performanceCheckRequestedCount: 2,
      performanceCheckSavedCount: 1,
      performanceCheckMissingCount: 1,
      performanceCheckImageCount: 2,
    })
  )
  expect(transport.trackListingFailed).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Write the failing partial-save test**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`, add this test after the test from Step 2:

```ts
it('keeps performance-check aggregates separate from vehicle save failures', () => {
  const transport = createTransport()
  const tracker = createWorkflowAnalytics({
    createBatchId: () => 'batch-partial-performance-checks',
    getFilesystemSupported: () => true,
    getNotificationEnabled: () => false,
    now: () => 400,
    transport,
  })
  const batch = tracker.previewStarted({ urlCount: 2, startedAt: 100 })
  const savedItem = {
    id: 'listing-1',
    url: firstUrl,
    listing: {
      ...listing,
      performanceCheckUrl: 'https://check.example.com/saved',
    },
  }
  const failedItem = {
    id: 'listing-2',
    url: secondUrl,
    listing: {
      ...listing,
      url: secondUrl,
      vnumber: '부산34나7890',
      performanceCheckUrl: 'https://check.example.com/not-saved',
    },
  }

  tracker.previewCompleted({
    batch,
    items: [
      { id: savedItem.id, url: savedItem.url, status: 'ready' },
      { id: failedItem.id, url: failedItem.url, status: 'ready' },
    ],
  })
  tracker.saveListingFailed({
    item: failedItem,
    message: '저장하지 못했어요.',
  })
  tracker.saveSettled({
    items: [savedItem, failedItem],
    saveMethod: 'directory',
    savedItemIds: new Set([savedItem.id]),
    saveResultsByItemId: new Map([
      [
        savedItem.id,
        createSaveResult({
          performanceCheckImageCount: 1,
          performanceCheckStatus: 'saved',
          sourceUrl: firstUrl,
        }),
      ],
    ]),
  })

  expect(transport.trackSaveFailed).toHaveBeenCalledWith(
    expect.objectContaining({
      batchId: 'batch-partial-performance-checks',
      savedCount: 1,
      saveFailedCount: 1,
      performanceCheckRequestedCount: 2,
      performanceCheckSavedCount: 1,
      performanceCheckMissingCount: 0,
      performanceCheckImageCount: 1,
    })
  )
  expect(transport.trackListingFailed).toHaveBeenCalledTimes(1)
  expect(transport.trackListingFailed).toHaveBeenCalledWith(
    expect.objectContaining({
      batchId: 'batch-partial-performance-checks',
      failureStage: 'save',
      listingUrl: secondUrl,
    })
  )
})
```

- [ ] **Step 4: Run the focused workflow analytics test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts
```

Expected: FAIL because `trackSaveCompleted` and `trackSaveFailed` inputs do not include the new performance-check aggregate fields.

- [ ] **Step 5: Add performance-check aggregate helpers**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`, add this interface after `interface SaveBatchGroup`:

```ts
interface PerformanceCheckBatchCounts {
  performanceCheckRequestedCount: number
  performanceCheckSavedCount: number
  performanceCheckMissingCount: number
  performanceCheckImageCount: number
}
```

Add this helper near the existing `getSaveCounts` helper:

```ts
const hasRequestedPerformanceCheck = (listing: TruckListing) =>
  Boolean(listing.performanceCheckUrl?.trim())

const getPerformanceCheckCounts = (
  group: SaveBatchGroup,
  saveResultsByItemId: ReadonlyMap<string, TruckSaveResult>
): PerformanceCheckBatchCounts => {
  let performanceCheckRequestedCount = 0
  let performanceCheckSavedCount = 0
  let performanceCheckMissingCount = 0
  let performanceCheckImageCount = 0

  group.items.forEach((item) => {
    const requested = hasRequestedPerformanceCheck(item.listing)

    if (requested) {
      performanceCheckRequestedCount += 1
    }

    const result = saveResultsByItemId.get(item.id)

    if (!result) {
      return
    }

    if (result.performanceCheckStatus === 'saved') {
      performanceCheckSavedCount += 1
    }

    if (requested && result.performanceCheckStatus === 'missing') {
      performanceCheckMissingCount += 1
    }

    performanceCheckImageCount += result.performanceCheckImageCount
  })

  return {
    performanceCheckRequestedCount,
    performanceCheckSavedCount,
    performanceCheckMissingCount,
    performanceCheckImageCount,
  }
}
```

- [ ] **Step 6: Thread aggregate counts through `toBatchInput()`**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`, extend the `toBatchInput()` options type to include `performanceCheckCounts`:

```ts
      performanceCheckCounts?: PerformanceCheckBatchCounts
```

Then add these fields to the `BatchAnalyticsInput` object returned by `toBatchInput()` after `saveFailedCount`:

```ts
    performanceCheckRequestedCount:
      options.performanceCheckCounts?.performanceCheckRequestedCount,
    performanceCheckSavedCount:
      options.performanceCheckCounts?.performanceCheckSavedCount,
    performanceCheckMissingCount:
      options.performanceCheckCounts?.performanceCheckMissingCount,
    performanceCheckImageCount:
      options.performanceCheckCounts?.performanceCheckImageCount,
```

- [ ] **Step 7: Use save result maps during settlement**

In `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`, change the `saveSettled` implementation signature from:

```ts
    saveSettled: ({ items, saveMethod, savedItemIds }) => {
```

to:

```ts
    saveSettled: ({ items, saveMethod, savedItemIds, saveResultsByItemId }) => {
```

Inside the `getSaveGroups(items).forEach((group) => { ... })` block, add:

```ts
const performanceCheckCounts = getPerformanceCheckCounts(group, saveResultsByItemId)
```

Then include `performanceCheckCounts` in the `toBatchInput()` options object:

```ts
            ...counts,
            saveMethod,
            performanceCheckCounts,
```

- [ ] **Step 8: Run the focused workflow analytics test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts
```

Expected: PASS. Missing performance-check records are aggregate counts, not listing failure events.

- [ ] **Step 9: Run the focused save workflow test again**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/save-workflow.test.ts
```

Expected: PASS. The save workflow still supplies result maps in both directory and ZIP paths.

- [ ] **Step 10: Commit Task 3**

Run:

```bash
git add src/v2/application/truck-harvester-workflow/workflow-analytics.ts src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts src/v2/application/truck-harvester-workflow/save-workflow.test.ts
git commit -m "feat: 성능점검 저장 결과 analytics 집계"
```

---

### Task 4: Full Verification

**Files:**

- Verify: all modified source and test files

- [ ] **Step 1: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 3: Run format check**

Run:

```bash
bun run format:check
```

Expected: PASS.

- [ ] **Step 4: Run the unit test suite**

Run:

```bash
bun run test -- --run
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 6: Inspect the final diff**

Run:

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/v2/shared/lib/analytics.ts src/v2/application/truck-harvester-workflow/workflow-analytics.ts src/v2/application/truck-harvester-workflow/save-workflow.ts
```

Expected: The diff only extends analytics counts and save result threading. It does not modify CheckPaper renderer logic, folder layout, UI copy, or failed-listing diagnostic policy.
The full branch diff may also include the approved design and plan docs under
`docs/superpowers/`.

- [ ] **Step 7: Commit verification fixes if any were required**

If Step 1-5 forced formatting or test-only fixes, commit them:

```bash
git add src/v2/shared/lib/analytics.ts src/v2/shared/lib/__tests__/analytics.test.ts src/v2/application/truck-harvester-workflow/workflow-analytics.ts src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts src/v2/application/truck-harvester-workflow/save-workflow.ts src/v2/application/truck-harvester-workflow/save-workflow.test.ts
git commit -m "test: 성능점검 analytics 검증 보강"
```

Expected: No commit is needed when Step 1-5 pass without changing files.
