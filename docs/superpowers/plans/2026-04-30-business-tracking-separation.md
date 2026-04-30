# Business Tracking Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Truck Harvester business workflow orchestration from Umami tracking details by introducing a focused `src/v2/application` layer.

**Architecture:** Add an application workflow slice between the root route and existing `features/*` capabilities. Keep preview/save use cases mostly React-free, keep browser lifecycle in `useTruckHarvesterWorkflow`, and isolate business fact to Umami payload conversion in `workflow-analytics.ts`.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Zustand vanilla stores, Vitest, Umami Cloud tracker.

---

## Scope Check

This plan covers one subsystem: the root Truck Harvester paste-preview-save workflow and its tracking boundary. It does not redesign UI, change Umami event names, add analytics providers, change save-folder persistence, or alter default concurrency.

## File Structure

- Create `src/v2/application/AGENTS.md`: Documents the application layer import rules and workflow ownership.
- Create `src/v2/application/index.ts`: Public application layer barrel.
- Create `src/v2/application/truck-harvester-workflow/index.ts`: Workflow slice public API.
- Create `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`: Converts workflow facts into existing analytics wrapper calls and owns batch/listing mapping.
- Create `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`: Unit coverage for analytics adapter state and payload conversion.
- Create `src/v2/application/truck-harvester-workflow/preview-workflow.ts`: Handles pasted text parsing, preview scheduling, duplicate helper state, and preview tracking facts.
- Create `src/v2/application/truck-harvester-workflow/preview-workflow.test.ts`: Unit coverage for supported input, unsupported input, duplicate input, preview failures, and abort cleanup.
- Create `src/v2/application/truck-harvester-workflow/save-workflow.ts`: Handles ready-listing save orchestration and save tracking facts.
- Create `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`: Unit coverage for directory and ZIP save outcomes.
- Create `src/v2/application/truck-harvester-workflow/use-truck-harvester-workflow.ts`: React adapter for stores, abort controllers, directory state, notification state, and workflow commands.
- Create `src/v2/features/listing-preparation/model/url-input-parser.ts`: Moves supported address extraction out of widget ownership.
- Create `src/v2/features/listing-preparation/model/__tests__/url-input-parser.test.ts`: Feature-level parser tests.
- Modify `src/v2/widgets/url-input/model/url-input-schema.ts`: Re-export parser helpers from the feature layer for existing widget imports.
- Modify `src/v2/features/listing-preparation/index.ts`: Export parser helpers and prepared-listing workflow types used by application use cases.
- Modify `src/app/truck-harvester-app.tsx`: Replace embedded orchestration and analytics helpers with `useTruckHarvesterWorkflow`.
- Modify `src/app/__tests__/truck-harvester-app.test.tsx`: Keep UI integration assertions while moving analytics payload specifics to application tests.
- Modify `src/v2/AGENTS.md`: Add the application layer to the layer map.
- Modify `src/v2/testing/__tests__/knowledge-base.test.ts`: Require the new application AGENTS guide.
- Modify `docs/architecture.md`: Document the application layer and tracking adapter boundary.

## Task 1: Move Paste URL Parsing Into The Feature Layer

**Files:**

- Create: `src/v2/features/listing-preparation/model/url-input-parser.ts`
- Create: `src/v2/features/listing-preparation/model/__tests__/url-input-parser.test.ts`
- Modify: `src/v2/widgets/url-input/model/url-input-schema.ts`
- Modify: `src/v2/features/listing-preparation/index.ts`

- [ ] **Step 1: Write the feature-level parser test**

Create `src/v2/features/listing-preparation/model/__tests__/url-input-parser.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { extractTruckUrlsFromText, parseUrlInputText } from '../url-input-parser'

const validUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

describe('listing preparation url input parser', () => {
  it('extracts supported truck listing addresses from pasted prose', () => {
    expect(extractTruckUrlsFromText(`확인 부탁드립니다\n${validUrl})\n감사합니다`)).toEqual([
      validUrl,
    ])
  })

  it('deduplicates normalized listing addresses', () => {
    expect(extractTruckUrlsFromText(`${validUrl}\n${validUrl}.`)).toEqual([validUrl])
  })

  it('returns Korean empty-input guidance for whitespace', () => {
    expect(parseUrlInputText(' \n\t ')).toEqual({
      success: false,
      message: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    })
  })

  it('returns Korean invalid-input guidance when no supported address exists', () => {
    expect(parseUrlInputText('DetailView.asp?ShopNo=1')).toEqual({
      success: false,
      message: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    })
  })

  it('returns supported listing addresses for valid pasted input', () => {
    expect(parseUrlInputText(`메모\n${validUrl}`)).toEqual({
      success: true,
      urls: [validUrl],
    })
  })
})
```

- [ ] **Step 2: Run the parser test to verify it fails**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/url-input-parser.test.ts
```

Expected: FAIL because `../url-input-parser` does not exist.

- [ ] **Step 3: Create the feature-owned parser**

Create `src/v2/features/listing-preparation/model/url-input-parser.ts`:

```ts
import { normalizeTruckUrl } from '@/v2/entities/url'
import { v2Copy } from '@/v2/shared/lib/copy'

export interface UrlInputSuccess {
  success: true
  urls: string[]
}

export interface UrlInputFailure {
  success: false
  message: string
}

export type UrlInputResult = UrlInputSuccess | UrlInputFailure

const supportedTruckUrlPattern =
  /https?:\/\/www\.truck-no1\.co\.kr\/model\/DetailView\.asp\?[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi
const trailingChatPunctuationPattern = /[.,)\]}]+$/g

const stripTrailingChatPunctuation = (value: string) =>
  value.replace(trailingChatPunctuationPattern, '')

export function extractTruckUrlsFromText(value: string): string[] {
  const normalizedUrls = new Set<string>()
  const matches = value.match(supportedTruckUrlPattern) ?? []

  for (const match of matches) {
    try {
      normalizedUrls.add(normalizeTruckUrl(stripTrailingChatPunctuation(match)))
    } catch {
      continue
    }
  }

  return Array.from(normalizedUrls)
}

export function parseUrlInputText(value: string): UrlInputResult {
  if (value.trim().length === 0) {
    return {
      success: false,
      message: v2Copy.urlInput.errors.empty,
    }
  }

  const urls = extractTruckUrlsFromText(value)

  if (urls.length === 0) {
    return {
      success: false,
      message: v2Copy.urlInput.errors.invalid,
    }
  }

  return {
    success: true,
    urls,
  }
}
```

- [ ] **Step 4: Run the parser test to verify it passes**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/url-input-parser.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the feature parser**

```bash
git add src/v2/features/listing-preparation/model/url-input-parser.ts src/v2/features/listing-preparation/model/__tests__/url-input-parser.test.ts
git commit -m "refactor: 입력 주소 파서 feature 계층 이동"
```

- [ ] **Step 6: Re-export parser helpers without changing widget imports**

Replace `src/v2/widgets/url-input/model/url-input-schema.ts` with:

```ts
export {
  extractTruckUrlsFromText,
  parseUrlInputText,
} from '@/v2/features/listing-preparation/model/url-input-parser'
export type {
  UrlInputFailure,
  UrlInputResult,
  UrlInputSuccess,
} from '@/v2/features/listing-preparation/model/url-input-parser'
```

Modify `src/v2/features/listing-preparation/index.ts`:

```ts
export {
  prepareListingUrls,
  type PreparedListingRunItem,
  type PreparedListingSettledItem,
  type PrepareListingUrlsInput,
} from './model/prepare-listings'
export * from './model/prepared-listing-store'
export {
  extractTruckUrlsFromText,
  parseUrlInputText,
  type UrlInputFailure,
  type UrlInputResult,
  type UrlInputSuccess,
} from './model/url-input-parser'
```

- [ ] **Step 7: Run existing URL input tests**

Run:

```bash
bun run test -- --run src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit parser re-exports**

```bash
git add src/v2/widgets/url-input/model/url-input-schema.ts src/v2/features/listing-preparation/index.ts
git commit -m "refactor: 입력 주소 파서 공개 경로 정리"
```

## Task 2: Add The Application Layer Guide And Barrels

**Files:**

- Create: `src/v2/application/AGENTS.md`
- Create: `src/v2/application/index.ts`
- Create: `src/v2/application/truck-harvester-workflow/index.ts`
- Modify: `src/v2/AGENTS.md`
- Modify: `src/v2/testing/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Write the failing knowledge-base assertion**

Modify `src/v2/testing/__tests__/knowledge-base.test.ts` so `layerAgentFiles` includes the application guide:

```ts
const layerAgentFiles = [
  'AGENTS.md',
  'src/v2/AGENTS.md',
  'src/v2/application/AGENTS.md',
  'src/v2/entities/AGENTS.md',
  'src/v2/features/AGENTS.md',
  'src/v2/shared/AGENTS.md',
  'src/v2/widgets/AGENTS.md',
]
```

Add this test inside `describe('v2 AI knowledge base', () => { ... })`:

```ts
it('documents the application workflow layer', () => {
  const guide = readText('src/v2/AGENTS.md')
  const applicationGuide = readText('src/v2/application/AGENTS.md')

  expect(guide).toContain('application/')
  expect(applicationGuide).toContain('business workflow orchestration')
  expect(applicationGuide).toContain('must not import widgets')
  expect(applicationGuide).toContain('workflow analytics')
})
```

- [ ] **Step 2: Run the knowledge-base test to verify it fails**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/knowledge-base.test.ts
```

Expected: FAIL because `src/v2/application/AGENTS.md` does not exist.

- [ ] **Step 3: Add the application AGENTS guide and layer map**

Create `src/v2/application/AGENTS.md`:

```md
# src/v2/application AGENTS.md

`src/v2/application` contains business workflow orchestration for the root
Truck Harvester app. It coordinates feature capabilities, browser adapters,
and workflow analytics without owning user-facing widgets.

## Responsibilities

- Own paste-preview-save use cases that span multiple feature slices.
- Keep business workflow code testable outside React when possible.
- Keep React lifecycle, abort controllers, and browser permission state inside
  hook adapters.
- Convert workflow facts to analytics through a workflow analytics adapter.

## Rules

- Application code may import from `src/v2/entities`, `src/v2/features`, and
  `src/v2/shared`.
- Application code must not import widgets.
- Features, shared helpers, and widgets must not import application code.
- UI components must not call analytics tracking functions directly.
- Workflow analytics observes facts and must not mutate prepared listing state.

## Knowledge Links

- Workflow architecture: `docs/architecture.md`
- Decisions: `docs/decisions/`
- Runbooks: `docs/runbooks/`
```

Modify the Layer Map in `src/v2/AGENTS.md`:

```md
- `application/`: root app business workflow orchestration, React hook
  adapters, and workflow analytics boundaries.
- `design-system/`: token docs and TypeScript helpers for CSS variables.
- `shared/`: base utilities, UI primitives, stores, and cross-feature
  helpers that do not know about a specific widget.
- `entities/`: pure domain schemas for truck listings, input addresses,
  downloads, and per-item states.
- `features/`: capabilities such as parsing, retrying, saving, and
  onboarding.
- `widgets/`: composed UI blocks for the root page.
```

- [ ] **Step 4: Add application public barrels**

Create `src/v2/application/index.ts`:

```ts
export * from './truck-harvester-workflow'
```

Create `src/v2/application/truck-harvester-workflow/index.ts`:

```ts
export {}
```

This is a temporary empty module until Task 6 creates the workflow hook.

- [ ] **Step 5: Run the knowledge-base test to verify it passes**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/knowledge-base.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit layer documentation**

```bash
git add src/v2/application/AGENTS.md src/v2/AGENTS.md src/v2/testing/__tests__/knowledge-base.test.ts
git commit -m "docs: application 계층 가이드 추가"
```

- [ ] **Step 7: Commit application barrels**

```bash
git add src/v2/application/index.ts src/v2/application/truck-harvester-workflow/index.ts
git commit -m "refactor: application workflow 공개 경로 추가"
```

## Task 3: Introduce The Workflow Analytics Adapter

**Files:**

- Create: `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`
- Create: `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`

- [ ] **Step 1: Write the analytics adapter tests**

Create `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { createWorkflowAnalytics } from './workflow-analytics'

const firstUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

const listing: TruckListing = {
  url: firstUrl,
  vname: '현대 메가트럭',
  vehicleName: '현대 메가트럭',
  vnumber: '서울12가3456',
  price: {
    raw: 3200,
    rawWon: 32000000,
    label: '3,200만원',
    compactLabel: '3,200만원',
  },
  year: '2020',
  mileage: '120,000km',
  options: '윙바디',
  images: ['https://img.example.com/1.jpg'],
}

const createTransport = () => ({
  trackBatchStarted: vi.fn(),
  trackListingFailed: vi.fn(),
  trackPreviewCompleted: vi.fn(),
  trackSaveCompleted: vi.fn(),
  trackSaveFailed: vi.fn(),
  trackSaveStarted: vi.fn(),
  trackUnsupportedInputFailure: vi.fn(),
})

describe('workflow analytics adapter', () => {
  it('tracks unsupported input without exposing Umami details to callers', () => {
    const transport = createTransport()
    const tracker = createWorkflowAnalytics({
      createBatchId: () => 'batch-unsupported',
      getFilesystemSupported: () => true,
      getNotificationEnabled: () => false,
      now: () => 15,
      transport,
    })

    tracker.unsupportedInputFailed({
      rawInput: '  DetailView.asp?ShopNo=1  ',
      startedAt: 5,
    })

    expect(transport.trackUnsupportedInputFailure).toHaveBeenCalledWith({
      batchId: 'batch-unsupported',
      rawInput: '  DetailView.asp?ShopNo=1  ',
      elapsedMs: 10,
    })
    expect(transport.trackBatchStarted).not.toHaveBeenCalled()
  })

  it('tracks preview start and completion using aggregate counts only', () => {
    const transport = createTransport()
    const tracker = createWorkflowAnalytics({
      createBatchId: () => 'batch-preview',
      getFilesystemSupported: () => true,
      getNotificationEnabled: () => true,
      now: () => 100,
      transport,
    })

    const batch = tracker.previewStarted({ urlCount: 2, startedAt: 25 })

    tracker.previewCompleted({
      batch,
      items: [
        { id: 'listing-1', url: firstUrl, status: 'ready' },
        {
          id: 'listing-2',
          url: `${firstUrl}&copy=2`,
          status: 'failed',
          message: '매물 이름을 확인하지 못했어요.',
        },
      ],
    })

    expect(transport.trackBatchStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
        urlCount: 2,
        uniqueUrlCount: 2,
        readyCount: 0,
      })
    )
    expect(transport.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
        urlCount: 2,
        uniqueUrlCount: 2,
        readyCount: 1,
        previewFailedCount: 1,
        notificationEnabled: true,
      })
    )
    expect(transport.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
        failureStage: 'preview',
        listingUrl: `${firstUrl}&copy=2`,
      })
    )
  })

  it('tracks save batches by original preview batch', () => {
    const transport = createTransport()
    const tracker = createWorkflowAnalytics({
      createBatchId: () => 'batch-save',
      getFilesystemSupported: () => true,
      getNotificationEnabled: () => false,
      now: () => 200,
      transport,
    })
    const batch = tracker.previewStarted({ urlCount: 1, startedAt: 100 })

    tracker.previewCompleted({
      batch,
      items: [{ id: 'listing-1', url: firstUrl, status: 'ready' }],
    })
    tracker.saveStarted({
      items: [{ id: 'listing-1', url: firstUrl, listing }],
      saveMethod: 'directory',
    })
    tracker.saveListingFailed({
      item: { id: 'listing-1', url: firstUrl, listing },
      message: '저장하지 못했어요.',
    })
    tracker.saveSettled({
      items: [{ id: 'listing-1', url: firstUrl, listing }],
      saveMethod: 'directory',
      savedItemIds: new Set(),
    })

    expect(transport.trackSaveStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-save',
        readyCount: 1,
        saveMethod: 'directory',
      })
    )
    expect(transport.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-save',
        failureStage: 'save',
        listingUrl: firstUrl,
        vehicleNumber: '서울12가3456',
        vehicleName: '현대 메가트럭',
        imageCount: 1,
      })
    )
    expect(transport.trackSaveFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-save',
        savedCount: 0,
        saveFailedCount: 1,
      })
    )
  })

  it('removes listing analytics state when a chip is removed', () => {
    const transport = createTransport()
    const tracker = createWorkflowAnalytics({
      createBatchId: () => 'batch-removed',
      getFilesystemSupported: () => false,
      getNotificationEnabled: () => false,
      now: () => 300,
      transport,
    })
    const batch = tracker.previewStarted({ urlCount: 1, startedAt: 250 })

    tracker.previewCompleted({
      batch,
      items: [{ id: 'listing-1', url: firstUrl, status: 'ready' }],
    })
    tracker.removeListing('listing-1')
    tracker.saveStarted({
      items: [{ id: 'listing-1', url: firstUrl, listing }],
      saveMethod: 'zip',
    })

    expect(transport.trackSaveStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: expect.stringMatching(/^batch-/),
        saveMethod: 'zip',
      })
    )
  })
})
```

- [ ] **Step 2: Run the analytics adapter tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts
```

Expected: FAIL because `workflow-analytics.ts` does not exist.

- [ ] **Step 3: Implement workflow analytics types and factory**

Create `src/v2/application/truck-harvester-workflow/workflow-analytics.ts`:

```ts
import {
  createAnalyticsBatchId,
  trackBatchStarted,
  trackListingFailed,
  trackPreviewCompleted,
  trackSaveCompleted,
  trackSaveFailed,
  trackSaveStarted,
  trackUnsupportedInputFailure,
  type BatchAnalyticsInput,
  type SaveMethod,
} from '@/v2/shared/lib/analytics'
import { type TruckListing } from '@/v2/entities/truck'

export interface AnalyticsBatchRef {
  id: string
  startedAt: number
  urlCount: number
}

export type WorkflowPreviewItem =
  | { id: string; url: string; status: 'ready' }
  | { id: string; url: string; status: 'failed' | 'invalid'; message: string }

export interface WorkflowSaveItem {
  id: string
  url: string
  listing: TruckListing
}

export interface WorkflowAnalyticsTransport {
  trackBatchStarted: typeof trackBatchStarted
  trackListingFailed: typeof trackListingFailed
  trackPreviewCompleted: typeof trackPreviewCompleted
  trackSaveCompleted: typeof trackSaveCompleted
  trackSaveFailed: typeof trackSaveFailed
  trackSaveStarted: typeof trackSaveStarted
  trackUnsupportedInputFailure: typeof trackUnsupportedInputFailure
}

export interface WorkflowTracker {
  unsupportedInputFailed: (event: { rawInput: string; startedAt: number }) => void
  previewStarted: (event: { urlCount: number; startedAt: number }) => AnalyticsBatchRef
  previewCompleted: (event: {
    batch: AnalyticsBatchRef
    items: readonly WorkflowPreviewItem[]
  }) => void
  saveStarted: (event: { items: readonly WorkflowSaveItem[]; saveMethod: SaveMethod }) => void
  saveListingFailed: (event: { item: WorkflowSaveItem; message: string }) => void
  saveSettled: (event: {
    items: readonly WorkflowSaveItem[]
    saveMethod: SaveMethod
    savedItemIds: ReadonlySet<string>
  }) => void
  removeListing: (id: string) => void
}

interface CreateWorkflowAnalyticsInput {
  createBatchId?: () => string
  getFilesystemSupported: () => boolean
  getNotificationEnabled: () => boolean
  now?: () => number
  transport?: WorkflowAnalyticsTransport
}

interface SaveBatchGroup {
  batch: AnalyticsBatchRef
  items: WorkflowSaveItem[]
}

const missingListingIdentityPlaceholder = '차명 정보 없음'

const defaultTransport: WorkflowAnalyticsTransport = {
  trackBatchStarted,
  trackListingFailed,
  trackPreviewCompleted,
  trackSaveCompleted,
  trackSaveFailed,
  trackSaveStarted,
  trackUnsupportedInputFailure,
}

const getDuration = (now: () => number, startedAt: number) =>
  Math.max(0, Math.round(now() - startedAt))

const isUsableListingIdentity = (value: string) => {
  const trimmedValue = value.trim()

  return trimmedValue.length > 0 && trimmedValue !== missingListingIdentityPlaceholder
}

const getSaveFailureVehicleName = (listing: TruckListing) =>
  [listing.vname, listing.vehicleName].find(isUsableListingIdentity) ||
  listing.vname ||
  listing.vehicleName

export function createWorkflowAnalytics({
  createBatchId = createAnalyticsBatchId,
  getFilesystemSupported,
  getNotificationEnabled,
  now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  transport = defaultTransport,
}: CreateWorkflowAnalyticsInput): WorkflowTracker {
  const batchByListingId = new Map<string, AnalyticsBatchRef>()
  const saveFailureIds = new Set<string>()

  const createBatch = (urlCount: number, startedAt: number): AnalyticsBatchRef => ({
    id: createBatchId(),
    startedAt,
    urlCount,
  })

  const toBatchInput = (
    batch: AnalyticsBatchRef,
    items: readonly WorkflowPreviewItem[],
    options: {
      saveMethod?: SaveMethod
      savedCount?: number
      saveFailedCount?: number
      uniqueUrlCount?: number
    } = {}
  ): BatchAnalyticsInput => ({
    batchId: batch.id,
    urlCount: batch.urlCount,
    uniqueUrlCount: options.uniqueUrlCount ?? items.length,
    readyCount: items.filter((item) => item.status === 'ready').length,
    invalidCount: items.filter((item) => item.status === 'invalid').length,
    previewFailedCount: items.filter((item) => item.status === 'failed').length,
    savedCount: options.savedCount ?? 0,
    saveFailedCount: options.saveFailedCount ?? 0,
    durationMs: getDuration(now, batch.startedAt),
    saveMethod: options.saveMethod,
    filesystemSupported: getFilesystemSupported(),
    notificationEnabled: getNotificationEnabled(),
  })

  const toReadyPreviewItems = (items: readonly WorkflowSaveItem[]): WorkflowPreviewItem[] =>
    items.map((item) => ({ id: item.id, url: item.url, status: 'ready' }))

  const ensureFallbackBatch = (items: readonly WorkflowSaveItem[]) => {
    const missingItems = items.filter((item) => !batchByListingId.has(item.id))

    if (missingItems.length === 0) {
      return
    }

    const fallbackBatch = createBatch(missingItems.length, now())

    missingItems.forEach((item) => {
      batchByListingId.set(item.id, fallbackBatch)
    })
  }

  const getSaveGroups = (items: readonly WorkflowSaveItem[]) => {
    ensureFallbackBatch(items)

    const groups: SaveBatchGroup[] = []
    const groupByBatchId = new Map<string, SaveBatchGroup>()

    items.forEach((item) => {
      const batch = batchByListingId.get(item.id)

      if (!batch) {
        return
      }

      const currentGroup = groupByBatchId.get(batch.id)

      if (currentGroup) {
        currentGroup.items.push(item)
        return
      }

      const nextGroup = { batch, items: [item] }
      groupByBatchId.set(batch.id, nextGroup)
      groups.push(nextGroup)
    })

    return groups
  }

  const getSaveCounts = (group: SaveBatchGroup, savedItemIds: ReadonlySet<string>) => ({
    savedCount: group.items.filter((item) => savedItemIds.has(item.id)).length,
    saveFailedCount: group.items.filter((item) => saveFailureIds.has(item.id)).length,
  })

  return {
    unsupportedInputFailed: ({ rawInput, startedAt }) => {
      transport.trackUnsupportedInputFailure({
        batchId: createBatchId(),
        rawInput,
        elapsedMs: getDuration(now, startedAt),
      })
    },
    previewStarted: ({ urlCount, startedAt }) => {
      const batch = createBatch(urlCount, startedAt)

      transport.trackBatchStarted(toBatchInput(batch, [], { uniqueUrlCount: urlCount }))

      return batch
    },
    previewCompleted: ({ batch, items }) => {
      items.forEach((item) => {
        batchByListingId.set(item.id, batch)
      })

      transport.trackPreviewCompleted(toBatchInput(batch, items))

      items.forEach((item) => {
        if (item.status === 'ready') {
          return
        }

        transport.trackListingFailed({
          batchId: batch.id,
          failureStage: item.status === 'invalid' ? 'invalid_url' : 'preview',
          failureReason: item.message,
          listingUrl: item.url,
          elapsedMs: getDuration(now, batch.startedAt),
        })
      })
    },
    saveStarted: ({ items, saveMethod }) => {
      getSaveGroups(items).forEach((group) => {
        transport.trackSaveStarted(
          toBatchInput(group.batch, toReadyPreviewItems(group.items), {
            saveMethod,
          })
        )
      })
    },
    saveListingFailed: ({ item, message }) => {
      const batch = batchByListingId.get(item.id)

      if (!batch) {
        return
      }

      saveFailureIds.add(item.id)
      transport.trackListingFailed({
        batchId: batch.id,
        failureStage: 'save',
        failureReason: message,
        listingUrl: item.url,
        vehicleNumber: item.listing.vnumber,
        vehicleName: getSaveFailureVehicleName(item.listing),
        imageCount: item.listing.images.length,
        elapsedMs: getDuration(now, batch.startedAt),
      })
    },
    saveSettled: ({ items, saveMethod, savedItemIds }) => {
      getSaveGroups(items).forEach((group) => {
        const counts = getSaveCounts(group, savedItemIds)
        const input = toBatchInput(group.batch, toReadyPreviewItems(group.items), {
          ...counts,
          saveMethod,
        })

        if (counts.savedCount === group.items.length) {
          transport.trackSaveCompleted(input)
          return
        }

        transport.trackSaveFailed(input)
      })
    },
    removeListing: (id) => {
      batchByListingId.delete(id)
      saveFailureIds.delete(id)
    },
  }
}
```

- [ ] **Step 4: Run the analytics adapter tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit analytics adapter**

```bash
git add src/v2/application/truck-harvester-workflow/workflow-analytics.ts src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts
git commit -m "refactor: workflow analytics adapter 추가"
```

## Task 4: Extract The Preview Workflow Use Case

**Files:**

- Create: `src/v2/application/truck-harvester-workflow/preview-workflow.ts`
- Create: `src/v2/application/truck-harvester-workflow/preview-workflow.test.ts`

- [ ] **Step 1: Write preview workflow tests**

Create `src/v2/application/truck-harvester-workflow/preview-workflow.test.ts`:

```ts
import { type StoreApi } from 'zustand/vanilla'
import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'
import {
  createPreparedListingStore,
  type PreparedListingState,
} from '@/v2/features/listing-preparation'

import { runPreviewWorkflow } from './preview-workflow'
import { type AnalyticsBatchRef, type WorkflowTracker } from './workflow-analytics'

const firstUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

const listing: TruckListing = {
  url: firstUrl,
  vname: '현대 메가트럭',
  vehicleName: '현대 메가트럭',
  vnumber: '서울12가3456',
  price: {
    raw: 3200,
    rawWon: 32000000,
    label: '3,200만원',
    compactLabel: '3,200만원',
  },
  year: '2020',
  mileage: '120,000km',
  options: '윙바디',
  images: [],
}

const createTracker = () => {
  const batch: AnalyticsBatchRef = {
    id: 'batch-1',
    startedAt: 10,
    urlCount: 1,
  }

  return {
    batch,
    tracker: {
      previewCompleted: vi.fn(),
      previewStarted: vi.fn(() => batch),
      removeListing: vi.fn(),
      saveListingFailed: vi.fn(),
      saveSettled: vi.fn(),
      saveStarted: vi.fn(),
      unsupportedInputFailed: vi.fn(),
    } satisfies WorkflowTracker,
  }
}

const runWorkflow = (input: {
  text: string
  store: StoreApi<PreparedListingState>
  parse?: (url: string, signal?: AbortSignal) => Promise<TruckListing>
  signal?: AbortSignal
  tracker?: WorkflowTracker
}) => {
  const { tracker } = createTracker()

  return runPreviewWorkflow({
    getStartedAt: () => 10,
    parse: input.parse ?? (async () => listing),
    signal: input.signal,
    store: input.store,
    text: input.text,
    tracker: input.tracker ?? tracker,
  })
}

describe('runPreviewWorkflow', () => {
  it('tracks unsupported non-empty input without starting preview', async () => {
    const store = createPreparedListingStore()
    const { tracker } = createTracker()

    const result = await runWorkflow({
      text: 'DetailView.asp?ShopNo=1',
      store,
      tracker,
    })

    expect(result).toEqual({
      duplicateMessage: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    })
    expect(tracker.unsupportedInputFailed).toHaveBeenCalledWith({
      rawInput: 'DetailView.asp?ShopNo=1',
      startedAt: 10,
    })
    expect(tracker.previewStarted).not.toHaveBeenCalled()
  })

  it('does not track whitespace input', async () => {
    const store = createPreparedListingStore()
    const { tracker } = createTracker()

    await runWorkflow({
      text: ' \n\t ',
      store,
      tracker,
    })

    expect(tracker.unsupportedInputFailed).not.toHaveBeenCalled()
    expect(tracker.previewStarted).not.toHaveBeenCalled()
  })

  it('adds supported URLs, previews them, and reports preview completion', async () => {
    const store = createPreparedListingStore()
    const { batch, tracker } = createTracker()

    const result = await runWorkflow({
      text: firstUrl,
      store,
      tracker,
    })

    expect(result).toEqual({ duplicateMessage: null })
    expect(store.getState().items[0]).toMatchObject({
      id: 'listing-1',
      status: 'ready',
      url: firstUrl,
    })
    expect(tracker.previewStarted).toHaveBeenCalledWith({
      urlCount: 1,
      startedAt: 10,
    })
    expect(tracker.previewCompleted).toHaveBeenCalledWith({
      batch,
      items: [{ id: 'listing-1', url: firstUrl, status: 'ready' }],
    })
  })

  it('returns the duplicate helper message for duplicate pasted addresses', async () => {
    const store = createPreparedListingStore()

    await runWorkflow({ text: firstUrl, store })
    const result = await runWorkflow({ text: firstUrl, store })

    expect(result).toEqual({ duplicateMessage: '이미 넣은 매물이에요.' })
  })

  it('passes preview failures to workflow analytics', async () => {
    const store = createPreparedListingStore()
    const { tracker } = createTracker()

    await runWorkflow({
      text: firstUrl,
      store,
      tracker,
      parse: async () => {
        throw new Error('network failed')
      },
    })

    expect(tracker.previewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            id: 'listing-1',
            message: '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.',
            status: 'failed',
            url: firstUrl,
          },
        ],
      })
    )
  })
})
```

- [ ] **Step 2: Run preview workflow tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/preview-workflow.test.ts
```

Expected: FAIL because `preview-workflow.ts` does not exist.

- [ ] **Step 3: Implement `runPreviewWorkflow`**

Create `src/v2/application/truck-harvester-workflow/preview-workflow.ts`:

```ts
import {
  parseUrlInputText,
  prepareListingUrls,
  type PreparedListingSettledItem,
  type PreparedListingState,
} from '@/v2/features/listing-preparation'
import { type TruckListing } from '@/v2/entities/truck'
import { type StoreApi } from 'zustand/vanilla'

import { type WorkflowPreviewItem, type WorkflowTracker } from './workflow-analytics'

interface RunPreviewWorkflowInput {
  getStartedAt?: () => number
  parse?: (url: string, signal?: AbortSignal) => Promise<TruckListing>
  signal?: AbortSignal
  store: StoreApi<PreparedListingState>
  text: string
  tracker: WorkflowTracker
}

interface RunPreviewWorkflowResult {
  duplicateMessage: string | null
}

const duplicateMessage = '이미 넣은 매물이에요.'

const toWorkflowPreviewItem = (item: PreparedListingSettledItem): WorkflowPreviewItem => {
  if (item.status === 'ready') {
    return {
      id: item.id,
      url: item.url,
      status: 'ready',
    }
  }

  return {
    id: item.id,
    url: item.url,
    status: item.status,
    message: item.message,
  }
}

export async function runPreviewWorkflow({
  getStartedAt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  parse,
  signal,
  store,
  text,
  tracker,
}: RunPreviewWorkflowInput): Promise<RunPreviewWorkflowResult> {
  const startedAt = getStartedAt()
  const input = parseUrlInputText(text)

  if (!input.success) {
    if (text.trim().length > 0) {
      tracker.unsupportedInputFailed({
        rawInput: text,
        startedAt,
      })
    }

    return { duplicateMessage: input.message }
  }

  const batch = tracker.previewStarted({
    urlCount: input.urls.length,
    startedAt,
  })

  const result = await prepareListingUrls({
    urls: input.urls,
    store,
    signal,
    parse,
  })

  tracker.previewCompleted({
    batch,
    items: result.settledItems.map(toWorkflowPreviewItem),
  })

  return {
    duplicateMessage: result.duplicates.length > 0 ? duplicateMessage : null,
  }
}
```

- [ ] **Step 4: Run preview workflow tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/preview-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit preview workflow**

```bash
git add src/v2/application/truck-harvester-workflow/preview-workflow.ts src/v2/application/truck-harvester-workflow/preview-workflow.test.ts
git commit -m "refactor: 미리보기 workflow use case 분리"
```

## Task 5: Extract The Save Workflow Use Case

**Files:**

- Create: `src/v2/application/truck-harvester-workflow/save-workflow.ts`
- Create: `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`

- [ ] **Step 1: Write save workflow tests**

Create `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'
import {
  createPreparedListingStore,
  type ReadyPreparedListing,
} from '@/v2/features/listing-preparation'

import { runSaveWorkflow } from './save-workflow'
import { type WorkflowTracker } from './workflow-analytics'

const firstUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

const listing: TruckListing = {
  url: firstUrl,
  vname: '현대 메가트럭',
  vehicleName: '현대 메가트럭',
  vnumber: '서울12가3456',
  price: {
    raw: 3200,
    rawWon: 32000000,
    label: '3,200만원',
    compactLabel: '3,200만원',
  },
  year: '2020',
  mileage: '120,000km',
  options: '윙바디',
  images: [],
}

const createReadyItem = (): ReadyPreparedListing => ({
  status: 'ready',
  id: 'listing-1',
  url: firstUrl,
  label: listing.vname,
  listing,
})

const createTracker = (): WorkflowTracker => ({
  previewCompleted: vi.fn(),
  previewStarted: vi.fn(),
  removeListing: vi.fn(),
  saveListingFailed: vi.fn(),
  saveSettled: vi.fn(),
  saveStarted: vi.fn(),
  unsupportedInputFailed: vi.fn(),
})

describe('runSaveWorkflow', () => {
  it('saves ready listings to a directory and reports completion', async () => {
    const store = createPreparedListingStore()
    const item = createReadyItem()
    const tracker = createTracker()

    store.setState({ items: [item] })

    const result = await runSaveWorkflow({
      items: [item],
      saveMethod: 'directory',
      saveTruckToDirectory: vi.fn().mockResolvedValue(undefined),
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 1 })
    expect(store.getState().items[0]).toMatchObject({
      status: 'saved',
      id: 'listing-1',
    })
    expect(tracker.saveStarted).toHaveBeenCalledWith({
      items: [{ id: 'listing-1', url: firstUrl, listing }],
      saveMethod: 'directory',
    })
    expect(tracker.saveSettled).toHaveBeenCalledWith({
      items: [{ id: 'listing-1', url: firstUrl, listing }],
      saveMethod: 'directory',
      savedItemIds: new Set(['listing-1']),
    })
  })

  it('marks a directory save failure and keeps the workflow running', async () => {
    const store = createPreparedListingStore()
    const item = createReadyItem()
    const tracker = createTracker()

    store.setState({ items: [item] })

    const result = await runSaveWorkflow({
      items: [item],
      saveMethod: 'directory',
      saveTruckToDirectory: vi.fn().mockRejectedValue(new Error('disk full')),
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 0 })
    expect(store.getState().items[0]).toMatchObject({
      status: 'failed',
      message: '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    })
    expect(tracker.saveListingFailed).toHaveBeenCalledWith({
      item: { id: 'listing-1', url: firstUrl, listing },
      message: '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    })
  })

  it('saves all ready listings through ZIP fallback', async () => {
    const store = createPreparedListingStore()
    const item = createReadyItem()
    const tracker = createTracker()

    store.setState({ items: [item] })

    const result = await runSaveWorkflow({
      downloadTruckZip: vi.fn().mockResolvedValue(undefined),
      items: [item],
      saveMethod: 'zip',
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 1 })
    expect(store.getState().items[0]).toMatchObject({ status: 'saved' })
  })

  it('marks all ready listings failed when ZIP fallback fails', async () => {
    const store = createPreparedListingStore()
    const item = createReadyItem()
    const tracker = createTracker()

    store.setState({ items: [item] })

    const result = await runSaveWorkflow({
      downloadTruckZip: vi.fn().mockRejectedValue(new Error('zip failed')),
      items: [item],
      saveMethod: 'zip',
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 0 })
    expect(store.getState().items[0]).toMatchObject({ status: 'failed' })
    expect(tracker.saveListingFailed).toHaveBeenCalledWith({
      item: { id: 'listing-1', url: firstUrl, listing },
      message: '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    })
  })
})
```

- [ ] **Step 2: Run save workflow tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/save-workflow.test.ts
```

Expected: FAIL because `save-workflow.ts` does not exist.

- [ ] **Step 3: Implement `runSaveWorkflow`**

Create `src/v2/application/truck-harvester-workflow/save-workflow.ts`:

```ts
import { type StoreApi } from 'zustand/vanilla'

import {
  downloadTruckZip as defaultDownloadTruckZip,
  saveTruckToDirectory as defaultSaveTruckToDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import {
  type PreparedListingSaveProgress,
  type PreparedListingState,
  type ReadyPreparedListing,
} from '@/v2/features/listing-preparation'
import { type SaveMethod } from '@/v2/shared/lib/analytics'

import { type WorkflowSaveItem, type WorkflowTracker } from './workflow-analytics'

const saveFailureMessage =
  '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'

type SaveTruckToDirectory = typeof defaultSaveTruckToDirectory
type DownloadTruckZip = typeof defaultDownloadTruckZip

interface RunSaveWorkflowInput {
  directory?: WritableDirectoryHandle | null
  downloadTruckZip?: DownloadTruckZip
  items: readonly ReadyPreparedListing[]
  saveMethod: SaveMethod
  saveTruckToDirectory?: SaveTruckToDirectory
  signal?: AbortSignal
  store: StoreApi<PreparedListingState>
  tracker: WorkflowTracker
}

interface RunSaveWorkflowResult {
  savedCount: number
}

const toWorkflowSaveItem = (item: ReadyPreparedListing): WorkflowSaveItem => ({
  id: item.id,
  url: item.url,
  listing: item.listing,
})

const canContinue = (signal?: AbortSignal) => !signal?.aborted

const markInitialSaving = (store: StoreApi<PreparedListingState>, item: ReadyPreparedListing) => {
  store.getState().markSaving(item.id, {
    downloadedImages: 0,
    totalImages: item.listing.images.length,
    progress: 0,
  })
}

const markFailed = (store: StoreApi<PreparedListingState>, item: ReadyPreparedListing) => {
  store.getState().markFailed(item.url, saveFailureMessage)
}

export async function runSaveWorkflow({
  directory = null,
  downloadTruckZip = defaultDownloadTruckZip,
  items,
  saveMethod,
  saveTruckToDirectory = defaultSaveTruckToDirectory,
  signal,
  store,
  tracker,
}: RunSaveWorkflowInput): Promise<RunSaveWorkflowResult> {
  const workflowItems = items.map(toWorkflowSaveItem)
  const savedItemIds = new Set<string>()
  let savedCount = 0

  tracker.saveStarted({ items: workflowItems, saveMethod })

  if (saveMethod === 'directory' && directory) {
    for (const item of items) {
      if (!canContinue(signal)) {
        return { savedCount }
      }

      markInitialSaving(store, item)

      try {
        await saveTruckToDirectory(directory, item.listing, {
          signal,
          onProgress: (progress: number, downloadedImages: number, totalImages: number) => {
            if (!canContinue(signal)) {
              return
            }

            store.getState().markSaving(item.id, {
              progress,
              downloadedImages,
              totalImages,
            } satisfies PreparedListingSaveProgress)
          },
        })

        if (!canContinue(signal)) {
          return { savedCount }
        }

        store.getState().markSaved(item.id)
        savedItemIds.add(item.id)
        savedCount += 1
      } catch {
        if (!canContinue(signal)) {
          return { savedCount }
        }

        tracker.saveListingFailed({
          item: toWorkflowSaveItem(item),
          message: saveFailureMessage,
        })
        markFailed(store, item)
      }
    }
  } else {
    items.forEach((item) => {
      markInitialSaving(store, item)
    })

    try {
      await downloadTruckZip(
        items.map((item) => item.listing),
        {
          signal,
          onProgress: (progress: number) => {
            if (!canContinue(signal)) {
              return
            }

            items.forEach((item) => {
              store.getState().markSaving(item.id, {
                progress,
                downloadedImages: 0,
                totalImages: item.listing.images.length,
              })
            })
          },
        }
      )

      if (!canContinue(signal)) {
        return { savedCount }
      }

      items.forEach((item) => {
        store.getState().markSaved(item.id)
        savedItemIds.add(item.id)
      })
      savedCount = items.length
    } catch {
      if (!canContinue(signal)) {
        return { savedCount }
      }

      items.forEach((item) => {
        tracker.saveListingFailed({
          item: toWorkflowSaveItem(item),
          message: saveFailureMessage,
        })
        markFailed(store, item)
      })
    }
  }

  tracker.saveSettled({
    items: workflowItems,
    saveMethod,
    savedItemIds,
  })

  return { savedCount }
}
```

- [ ] **Step 4: Run save workflow tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/save-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit save workflow**

```bash
git add src/v2/application/truck-harvester-workflow/save-workflow.ts src/v2/application/truck-harvester-workflow/save-workflow.test.ts
git commit -m "refactor: 저장 workflow use case 분리"
```

## Task 6: Add The React Workflow Hook

**Files:**

- Create: `src/v2/application/truck-harvester-workflow/use-truck-harvester-workflow.ts`
- Modify: `src/v2/application/truck-harvester-workflow/index.ts`

- [ ] **Step 1: Replace the temporary barrel with the hook export**

Replace `src/v2/application/truck-harvester-workflow/index.ts`:

```ts
export * from './use-truck-harvester-workflow'
```

- [ ] **Step 2: Implement the workflow hook**

Create `src/v2/application/truck-harvester-workflow/use-truck-harvester-workflow.ts`:

```ts
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useStore } from 'zustand'

import {
  isCompletionNotificationAvailable,
  notifyCompletion,
  requestCompletionNotificationPermission,
} from '@/v2/features/completion-notification'
import {
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  requestWritableDirectoryPermission,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import {
  createPreparedListingStore,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
  type PreparedListing,
} from '@/v2/features/listing-preparation'
import { createOnboardingStore } from '@/v2/shared/model'
import { type SaveMethod } from '@/v2/shared/lib/analytics'

import { runPreviewWorkflow } from './preview-workflow'
import { runSaveWorkflow } from './save-workflow'
import { createWorkflowAnalytics } from './workflow-analytics'

const saveFolderPickerId = 'truck-harvester-v2-save-folder'
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

type DirectoryPermissionState = 'denied' | 'ready'
type DirectoryPickerStartIn = WritableDirectoryHandle | 'downloads'

const pickSaveDirectory = pickWritableDirectory as (options: {
  id: string
  startIn: DirectoryPickerStartIn
}) => Promise<WritableDirectoryHandle | undefined>

const requestNextFrame = (callback: () => void) => {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }

  return window.setTimeout(callback, 16)
}

const cancelNextFrame = (handle: number) => {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle)
    return
  }

  window.clearTimeout(handle)
}

const getNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

const isNotificationEnabled = (permission: NotificationPermission | 'unsupported') =>
  permission === 'granted'

export function useTruckHarvesterWorkflow() {
  const [preparedStore] = useState(() => createPreparedListingStore())
  const [onboardingStore] = useState(() => createOnboardingStore({ deferInitialTour: true }))
  const [directory, setDirectory] = useState<WritableDirectoryHandle | null>(null)
  const [directoryPermissionState, setDirectoryPermissionState] =
    useState<DirectoryPermissionState>('ready')
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null)
  const [fileSystemSupported, setFileSystemSupported] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [notificationAvailable, setNotificationAvailable] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported')
  const isMountedRef = useRef(false)
  const pasteSequenceRef = useRef(0)
  const previewControllersRef = useRef<Set<AbortController>>(new Set())
  const saveControllerRef = useRef<AbortController | null>(null)
  const fileSystemSupportedRef = useRef(false)
  const notificationEnabledRef = useRef(false)
  const [tracker] = useState(() =>
    createWorkflowAnalytics({
      getFilesystemSupported: () => fileSystemSupportedRef.current,
      getNotificationEnabled: () => notificationEnabledRef.current,
    })
  )

  const preparedState = useStore(preparedStore, (state) => state)
  const onboardingState = useStore(onboardingStore, (state) => state)
  const readyListings = selectReadyPreparedListings(preparedState)
  const checkingListings = selectCheckingPreparedListings(preparedState)
  const inputListings = preparedState.items.filter((item) => item.status !== 'saved')
  const isTourOpen = onboardingState.isTourOpen
  fileSystemSupportedRef.current = fileSystemSupported
  notificationEnabledRef.current = isNotificationEnabled(notificationPermission)

  useBrowserLayoutEffect(() => {
    const supported = isFileSystemAccessAvailable()
    setFileSystemSupported(supported)
    setDirectoryPermissionState('ready')

    if (isCompletionNotificationAvailable()) {
      setNotificationAvailable(true)
      setNotificationPermission(window.Notification.permission)
    }

    const frame = requestNextFrame(() => {
      onboardingStore.getState().initializeTour()
    })

    return () => {
      cancelNextFrame(frame)
    }
  }, [onboardingStore])

  useEffect(() => {
    isMountedRef.current = true
    const previewControllers = previewControllersRef.current

    return () => {
      isMountedRef.current = false
      previewControllers.forEach((controller) => controller.abort())
      previewControllers.clear()
      saveControllerRef.current?.abort()
      saveControllerRef.current = null
    }
  }, [])

  const resolveSaveDirectoryForRun = async () => {
    if (!isFileSystemAccessAvailable()) {
      return null
    }

    const activeDirectory = directory

    if (activeDirectory) {
      if (directoryPermissionState === 'denied') {
        const nextDirectory = await pickSaveDirectory({
          id: saveFolderPickerId,
          startIn: 'downloads',
        })

        if (!nextDirectory) {
          return undefined
        }

        if (isMountedRef.current) {
          setDirectory(nextDirectory)
          setDirectoryPermissionState('ready')
        }

        return nextDirectory
      }

      const hasPermission = await requestWritableDirectoryPermission(activeDirectory)

      if (!hasPermission) {
        if (isMountedRef.current) {
          setDirectoryPermissionState('denied')
        }
        return undefined
      }

      if (isMountedRef.current) {
        setDirectory(activeDirectory)
        setDirectoryPermissionState('ready')
      }

      return activeDirectory
    }

    const nextDirectory = await pickSaveDirectory({
      id: saveFolderPickerId,
      startIn: 'downloads',
    })

    if (!nextDirectory) {
      return undefined
    }

    if (isMountedRef.current) {
      setDirectory(nextDirectory)
      setDirectoryPermissionState('ready')
    }

    return nextDirectory
  }

  const selectDirectory = async (nextDirectory: WritableDirectoryHandle) => {
    if (isMountedRef.current) {
      setDirectory(nextDirectory)
      setDirectoryPermissionState('ready')
    }
  }

  const handlePasteText = (text: string) => {
    const pasteSequence = pasteSequenceRef.current + 1
    pasteSequenceRef.current = pasteSequence
    const previewController = new AbortController()
    previewControllersRef.current.add(previewController)

    void runPreviewWorkflow({
      getStartedAt: getNow,
      signal: previewController.signal,
      store: preparedStore,
      text,
      tracker,
    })
      .then((result) => {
        if (!isMountedRef.current || previewController.signal.aborted) {
          return
        }

        if (pasteSequenceRef.current === pasteSequence) {
          setDuplicateMessage(result.duplicateMessage)
        }
      })
      .catch(() => {
        // Preview cancellation is expected when leaving the route.
      })
      .finally(() => {
        previewControllersRef.current.delete(previewController)
      })
  }

  const requestNotificationPermission = () => {
    void requestCompletionNotificationPermission().then((permission) => {
      if (isMountedRef.current) {
        setNotificationPermission(permission)
      }
    })
  }

  const startSavingReadyListings = async () => {
    if (isSaving || readyListings.length === 0 || checkingListings.length > 0) {
      return
    }

    const controller = new AbortController()
    saveControllerRef.current?.abort()
    saveControllerRef.current = controller

    try {
      const runDirectory = await resolveSaveDirectoryForRun()

      if (!isMountedRef.current || controller.signal.aborted) {
        return
      }

      if (runDirectory === undefined) {
        return
      }

      const saveMethod: SaveMethod = runDirectory ? 'directory' : 'zip'
      const itemsToSave = readyListings
      setIsSaving(true)

      const result = await runSaveWorkflow({
        directory: runDirectory,
        items: itemsToSave,
        saveMethod,
        signal: controller.signal,
        store: preparedStore,
        tracker,
      })

      if (result.savedCount > 0 && isMountedRef.current) {
        notifyCompletion(result.savedCount)
      }
    } finally {
      if (saveControllerRef.current === controller) {
        saveControllerRef.current = null
      }

      if (isMountedRef.current) {
        setIsSaving(false)
      }
    }
  }

  const removePreparedItem = (id: string) => {
    tracker.removeListing(id)
    preparedStore.getState().remove(id)
  }

  const canRemovePreparedItem = (item: PreparedListing) =>
    item.status !== 'saving' && item.status !== 'saved'

  return {
    canRemovePreparedItem,
    directory,
    directoryPermissionState,
    duplicateMessage,
    fileSystemSupported,
    handlePasteText,
    inputListings,
    isSaving,
    isTourOpen,
    notificationAvailable,
    notificationPermission,
    onboardingState,
    preparedItems: preparedState.items,
    pickerStartIn: directoryPermissionState === 'denied' ? 'downloads' : (directory ?? 'downloads'),
    removePreparedItem,
    requestNotificationPermission,
    selectDirectory,
    startSavingReadyListings,
  }
}
```

- [ ] **Step 3: Run typecheck to catch hook boundary errors**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit workflow hook**

```bash
git add src/v2/application/truck-harvester-workflow/use-truck-harvester-workflow.ts src/v2/application/truck-harvester-workflow/index.ts
git commit -m "refactor: root workflow hook 추가"
```

## Task 7: Slim The Root App Composition

**Files:**

- Modify: `src/app/truck-harvester-app.tsx`
- Modify: `src/app/__tests__/truck-harvester-app.test.tsx`

- [ ] **Step 1: Update the app test mocks to target the application boundary**

In `src/app/__tests__/truck-harvester-app.test.tsx`, keep the existing UI helper functions. Replace the analytics mock assertions in route-level tests with UI outcome assertions for these cases:

```ts
expect(container?.textContent).toContain(
  '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.'
)
expect(listingPreparationMocks.prepareListingUrls).not.toHaveBeenCalled()
```

For save success, keep:

```ts
expect(statusRegion?.textContent).toContain('저장 완료')
expect(inputRegion?.textContent).not.toContain('현대 메가트럭')
```

Move payload-specific expectations for `trackBatchStarted`,
`trackPreviewCompleted`, `trackListingFailed`, `trackSaveStarted`,
`trackSaveCompleted`, and `trackSaveFailed` out of route tests because
`workflow-analytics.test.ts` owns them.

- [ ] **Step 2: Run the route test to verify the old root implementation still passes before slimming**

Run:

```bash
bun run test -- --run src/app/__tests__/truck-harvester-app.test.tsx
```

Expected: PASS before the component is slimmed.

- [ ] **Step 3: Replace root orchestration with the workflow hook**

Replace `src/app/truck-harvester-app.tsx` with:

```tsx
'use client'

import { CompletionNotificationToggle } from '@/v2/features/completion-notification'
import { HelpMenuButton, TourOverlay, tourSteps } from '@/v2/features/onboarding'
import { useTruckHarvesterWorkflow } from '@/v2/application'
import { DirectorySelector } from '@/v2/widgets/directory-selector'
import { PreparedListingStatusPanel } from '@/v2/widgets/processing-status'
import { ListingChipInput } from '@/v2/widgets/url-input'

export function TruckHarvesterApp() {
  const workflow = useTruckHarvesterWorkflow()

  return (
    <main className="min-h-dvh bg-background text-foreground" data-tour="v2-page">
      <section
        className="mx-auto grid min-h-dvh w-full max-w-6xl gap-6 px-6 py-8 md:px-10"
        data-tour-background="true"
        inert={workflow.isTourOpen ? true : undefined}
      >
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">새 작업 화면</p>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              트럭 매물 수집기
            </h1>
          </div>
          <HelpMenuButton
            disabled={workflow.isTourOpen}
            onRestartTour={workflow.onboardingState.restartTour}
          />
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="grid content-start gap-5">
            <div data-tour="url-input">
              <ListingChipInput
                canRemoveItem={workflow.canRemovePreparedItem}
                disabled={workflow.isSaving || workflow.isTourOpen}
                duplicateMessage={workflow.duplicateMessage}
                items={workflow.inputListings}
                onPasteText={workflow.handlePasteText}
                onRemove={workflow.removePreparedItem}
                onStart={() => void workflow.startSavingReadyListings()}
              />
            </div>
          </div>

          <div className="grid content-start gap-5">
            <DirectorySelector
              disabled={workflow.isTourOpen}
              isSupported={workflow.fileSystemSupported}
              onSelectDirectory={workflow.selectDirectory}
              permissionState={workflow.directoryPermissionState}
              pickerStartIn={workflow.pickerStartIn}
              selectedDirectoryName={workflow.directory?.name}
            />
            <CompletionNotificationToggle
              disabled={workflow.isTourOpen}
              isAvailable={workflow.notificationAvailable}
              onEnable={workflow.requestNotificationPermission}
              permission={workflow.notificationPermission}
            />
            <div data-tour="processing-status">
              <PreparedListingStatusPanel items={workflow.preparedItems} />
            </div>
          </div>
        </div>
      </section>

      <TourOverlay
        currentStep={workflow.onboardingState.currentStep}
        isOpen={workflow.onboardingState.isTourOpen}
        onClose={workflow.onboardingState.completeTour}
        onNext={() => workflow.onboardingState.goToNextStep(tourSteps.length)}
        onPrevious={workflow.onboardingState.goToPreviousStep}
      />
    </main>
  )
}
```

- [ ] **Step 4: Run root app and application tests**

Run:

```bash
bun run test -- --run src/app/__tests__/truck-harvester-app.test.tsx src/v2/application/truck-harvester-workflow
```

Expected: PASS.

- [ ] **Step 5: Commit root composition slimming**

```bash
git add src/app/truck-harvester-app.tsx src/app/__tests__/truck-harvester-app.test.tsx
git commit -m "refactor: root 앱 workflow composition 축소"
```

## Task 8: Document The New Workflow Boundary

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/superpowers/specs/2026-04-30-business-tracking-separation-design.md`

- [ ] **Step 1: Update architecture layer responsibilities**

Modify the `Layer Responsibilities` section in `docs/architecture.md`:

```md
- `src/app`: root route composition, page layout, and widget wiring.
- `src/v2/application`: root app workflow orchestration, React hook adapters,
  and workflow analytics boundaries.
- `src/v2/widgets`: user-facing blocks that compose features and shared
  selectors.
- `src/v2/features`: capabilities such as listing preparation, parsing,
  saving, completion notifications, and onboarding.
- `src/v2/entities`: pure schemas and state contracts.
- `src/v2/shared`: utilities, stores, selectors, analytics transport, and
  low-level UI.
- `src/v2/design-system`: tokens and motion presets for the root app.
```

Add this paragraph after the Umami analytics paragraph:

```md
The application workflow layer emits business facts to a workflow analytics
adapter. The route component and widgets do not assemble Umami payloads, and
preview/save use cases do not call `window.umami` directly. The shared
analytics transport remains the only layer that knows the concrete Umami event
names and payload keys.
```

- [ ] **Step 2: Mark implementation plan linkage in the approved spec**

Add this section near the end of `docs/superpowers/specs/2026-04-30-business-tracking-separation-design.md`:

```md
## Implementation Plan

Execution plan: `docs/superpowers/plans/2026-04-30-business-tracking-separation.md`
```

- [ ] **Step 3: Run documentation tests and formatting for changed docs**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/knowledge-base.test.ts
bun prettier --check docs/architecture.md docs/superpowers/specs/2026-04-30-business-tracking-separation-design.md
```

Expected: both commands PASS.

- [ ] **Step 4: Commit documentation updates**

```bash
git add docs/architecture.md docs/superpowers/specs/2026-04-30-business-tracking-separation-design.md
git commit -m "docs: application workflow 경계 문서화"
```

## Task 9: Final Verification

**Files:**

- Verify only.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow src/v2/features/listing-preparation/model/__tests__/url-input-parser.test.ts src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts src/app/__tests__/truck-harvester-app.test.tsx
```

Expected: PASS.

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

- [ ] **Step 4: Run finite unit suite**

Run:

```bash
bun run test -- --run
```

Expected: PASS.

- [ ] **Step 5: Run format check and record known unrelated warnings**

Run:

```bash
bun run format:check
```

Expected after this refactor: PASS. If it reports only the pre-existing
`src/app/apple-icon.tsx`, `src/app/icon.tsx`, and `src/app/opengraph-image.tsx`
warnings seen before this plan, record that in the final report and do not
silently reformat those unrelated files inside this refactor.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git status --short
git diff --stat origin/main..HEAD
git log --oneline origin/main..HEAD
```

Expected: working tree clean after commits; history shows focused refactor and docs commits.

- [ ] **Step 7: Prepare final implementation summary**

Report:

```md
Implemented application workflow separation.

Key commits:

- <hash> refactor: 입력 주소 파서 feature 계층 이동
- <hash> refactor: workflow analytics adapter 추가
- <hash> refactor: 미리보기 workflow use case 분리
- <hash> refactor: 저장 workflow use case 분리
- <hash> refactor: root workflow hook 추가
- <hash> refactor: root 앱 workflow composition 축소
- <hash> docs: application workflow 경계 문서화

Verification:

- bun run test -- --run ...
- bun run typecheck
- bun run lint
- bun run test -- --run
- bun run format:check
```
