# v2 칩 입력 작업판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v2 URL-list workflow with a one-screen workbench where pasted text becomes Notion-style listing chips, verified listings can be saved, and completion is clear without modal interruptions.

**Architecture:** Add a focused `listing-preparation` feature for URL extraction, preview fetching, and prepared-listing state. Replace the current v2 page wiring with prepared listings as the user-visible source of truth, while reusing existing `/api/v2/parse-truck`, `saveTruckToDirectory`, and directory picker helpers. Keep legacy `/`, `src/shared`, `src/widgets`, and `src/app/page.tsx` untouched.

**Tech Stack:** Next.js App Router, React 19, Zustand vanilla stores, TanStack Form is no longer needed for the new chip input surface, Vitest, Playwright, Tailwind CSS, lucide-react, File System Access API, Web Notifications API.

---

## Scope And Guardrails

- Work only in `src/app/v2/*`, `src/v2/*`, `e2e/*`, and `docs/*`.
- Do not import Sentry from any `/v2` code.
- Do not add watermark behavior to `/v2`.
- Keep default preview/save concurrency at 5.
- UI copy must be Korean-only and understandable by non-technical staff.
- Do not make a modal for completion.
- Do not implement in-progress item cancellation. It is tracked in GitHub issue #8.
- Do not implement URL editing inside failed chips. Recovery is `지우기 -> 다시 붙여넣기`.

## File Structure

- Modify `src/v2/widgets/url-input/model/url-input-schema.ts`
  - Responsibility: extract and normalize supported truck listing URLs from arbitrary pasted text.
- Modify `src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts`
  - Responsibility: regression tests for mixed pasted text, duplicates, unsupported input, and legacy parser compatibility.
- Create `src/v2/features/listing-preparation/model/prepared-listing-store.ts`
  - Responsibility: prepared-listing state, dedupe, status transitions, save progress, and selectors.
- Create `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`
  - Responsibility: store transition tests.
- Create `src/v2/features/listing-preparation/model/prepare-listings.ts`
  - Responsibility: run preview fetches for newly pasted URLs with concurrency 5 and update the prepared-listing store.
- Create `src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts`
  - Responsibility: preview success/failure/concurrency tests.
- Create `src/v2/features/listing-preparation/index.ts`
  - Responsibility: public exports for the feature.
- Create `src/v2/widgets/url-input/ui/listing-chip-input.tsx`
  - Responsibility: Notion-style chip input surface for prepared listings.
- Create `src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx`
  - Responsibility: render, copy, state, and removal tests for the chip input.
- Modify `src/v2/widgets/url-input/index.ts`
  - Responsibility: export the new chip input without breaking existing exports.
- Create `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`
  - Responsibility: prepared-listing progress summary and per-listing status rows using user-readable labels.
- Create `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`
  - Responsibility: summary, completion, labels, and no-`truck-1` regression tests.
- Modify `src/v2/widgets/processing-status/index.ts`
  - Responsibility: export the new prepared status panel.
- Create `src/v2/features/completion-notification/model/completion-notification.ts`
  - Responsibility: optional desktop notification permission and completion notification helpers.
- Create `src/v2/features/completion-notification/model/__tests__/completion-notification.test.ts`
  - Responsibility: notification availability, permission, allowed, denied, and no-op tests.
- Create `src/v2/features/completion-notification/ui/completion-notification-toggle.tsx`
  - Responsibility: small non-blocking `완료 알림 켜기` control.
- Create `src/v2/features/completion-notification/ui/__tests__/completion-notification-toggle.test.tsx`
  - Responsibility: copy and click behavior tests.
- Create `src/v2/features/completion-notification/index.ts`
  - Responsibility: public exports for notification feature.
- Modify `src/app/v2/truck-harvester-v2-app.tsx`
  - Responsibility: wire prepared listings, save flow, directory selection, progress, and optional notifications.
- Modify `src/v2/shared/lib/copy.ts`
  - Responsibility: Korean copy for chip input, prepared statuses, completion summary, and notifications.
- Modify `src/v2/testing/__tests__/knowledge-base.test.ts`
  - Responsibility: assert the new plan/spec docs are discoverable if the current test expects docs inventory.
- Modify `e2e/happy-path-batch.spec.ts`
  - Responsibility: update happy path for chip input and prepared listing labels.
- Create `e2e/chip-input-workbench.spec.ts`
  - Responsibility: end-to-end mixed-text paste, automatic preview, removal, save, and completion summary.
- Modify `e2e/a11y.spec.ts`
  - Responsibility: keep v2 accessibility smoke coverage with the new UI.

## Task 1: URL Extraction From Arbitrary Pasted Text

**Files:**

- Modify: `src/v2/widgets/url-input/model/url-input-schema.ts`
- Modify: `src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts`.

```ts
import { extractTruckUrlsFromText, parseUrlInputText } from '../url-input-schema'

const messyText = `
  사장님 이 매물 확인 부탁드립니다.
  https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3

  다음 것도 같이요 https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4 감사합니다.
  중복: http://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3#photo
`

it('extracts supported truck urls from pasted chat text and removes duplicates', () => {
  expect(extractTruckUrlsFromText(messyText)).toEqual([
    'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
    'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4',
  ])
})

it('returns an empty list when pasted text has no supported truck urls', () => {
  expect(extractTruckUrlsFromText('이 문장에는 https://example.com/truck/1 만 있습니다.')).toEqual(
    []
  )
})

it('keeps parseUrlInputText compatible with extracted pasted text', () => {
  expect(parseUrlInputText(messyText)).toEqual({
    success: true,
    urls: [
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4',
    ],
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun run test -- --run src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts
```

Expected: FAIL because `extractTruckUrlsFromText` is not exported.

- [ ] **Step 3: Implement URL extraction**

Update `src/v2/widgets/url-input/model/url-input-schema.ts`.

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
  /https?:\/\/www\.truck-no1\.co\.kr\/model\/DetailView\.asp\?[^\s<>"'`]+/gi

export function extractTruckUrlsFromText(value: string) {
  const matches = value.match(supportedTruckUrlPattern) ?? []
  const urls: string[] = []

  for (const match of matches) {
    try {
      urls.push(normalizeTruckUrl(match))
    } catch {
      continue
    }
  }

  return Array.from(new Set(urls))
}

export function parseUrlInputText(value: string): UrlInputResult {
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

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
bun run test -- --run src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/widgets/url-input/model/url-input-schema.ts src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts
git commit -m "feat: v2 붙여넣기 주소 추출 개선"
```

## Task 2: Prepared Listing Store

**Files:**

- Create: `src/v2/features/listing-preparation/model/prepared-listing-store.ts`
- Create: `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`
- Create: `src/v2/features/listing-preparation/index.ts`

- [ ] **Step 1: Write the failing store tests**

Create `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`.

```ts
import { describe, expect, it } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { createPreparedListingStore, selectReadyPreparedListings } from '../prepared-listing-store'

const firstUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
const secondUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4'

const listing: TruckListing = {
  url: firstUrl,
  vname: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
  vehicleName: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
  vnumber: '서울01가1234',
  price: {
    raw: 3550,
    rawWon: 35500000,
    label: '3,550만원',
    compactLabel: '3.6천만',
  },
  year: '2020',
  mileage: '150,000km',
  options: '냉동탑 / 후방카메라',
  images: ['https://img.example.com/one.jpg'],
}

describe('prepared listing store', () => {
  it('adds new urls as checking chips and reports duplicates', () => {
    const store = createPreparedListingStore()

    expect(store.getState().addUrls([firstUrl, secondUrl, firstUrl])).toEqual({
      added: [firstUrl, secondUrl],
      duplicates: [firstUrl],
    })
    expect(store.getState().items).toMatchObject([
      { id: 'listing-1', url: firstUrl, status: 'checking', label: '매물 이름 찾는 중' },
      { id: 'listing-2', url: secondUrl, status: 'checking', label: '매물 이름 찾는 중' },
    ])
  })

  it('marks a checking item ready with a human-readable listing label', () => {
    const store = createPreparedListingStore()
    store.getState().addUrls([firstUrl])

    store.getState().markReady(firstUrl, listing)

    expect(store.getState().items[0]).toMatchObject({
      status: 'ready',
      label: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
      listing,
    })
  })

  it('keeps failed chips removable and explains recovery in Korean', () => {
    const store = createPreparedListingStore()
    store.getState().addUrls([firstUrl])

    store
      .getState()
      .markFailed(firstUrl, '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.')
    expect(store.getState().items[0]).toMatchObject({
      status: 'failed',
      label: '매물 이름을 확인하지 못했어요',
      message: '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.',
    })

    store.getState().remove('listing-1')
    expect(store.getState().items).toEqual([])
  })

  it('tracks save progress and selects ready listings only', () => {
    const store = createPreparedListingStore()
    store.getState().addUrls([firstUrl, secondUrl])
    store.getState().markReady(firstUrl, listing)
    store
      .getState()
      .markFailed(secondUrl, '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.')

    expect(selectReadyPreparedListings(store.getState())).toHaveLength(1)

    store.getState().markSaving('listing-1', {
      downloadedImages: 0,
      totalImages: 1,
      progress: 0,
    })
    expect(store.getState().items[0]).toMatchObject({
      status: 'saving',
      downloadedImages: 0,
      totalImages: 1,
      progress: 0,
    })

    store.getState().markSaved('listing-1')
    expect(store.getState().items[0]).toMatchObject({
      status: 'saved',
      downloadedImages: 1,
      totalImages: 1,
      progress: 100,
    })
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts
```

Expected: FAIL because the feature files do not exist.

- [ ] **Step 3: Implement the store**

Create `src/v2/features/listing-preparation/model/prepared-listing-store.ts`.

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'

export type PreparedListingStatus = 'checking' | 'ready' | 'invalid' | 'failed' | 'saving' | 'saved'

export interface PreparedListingProgress {
  downloadedImages: number
  totalImages: number
  progress: number
}

export interface PreparedListing {
  id: string
  url: string
  status: PreparedListingStatus
  label: string
  listing?: TruckListing
  message?: string
  downloadedImages?: number
  totalImages?: number
  progress?: number
}

export interface AddPreparedUrlsResult {
  added: string[]
  duplicates: string[]
}

export interface PreparedListingState {
  items: PreparedListing[]
  addUrls: (urls: readonly string[]) => AddPreparedUrlsResult
  markReady: (url: string, listing: TruckListing) => void
  markInvalid: (url: string, message: string) => void
  markFailed: (url: string, message: string) => void
  markSaving: (id: string, progress: PreparedListingProgress) => void
  markSaved: (id: string) => void
  remove: (id: string) => void
  reset: () => void
}

const checkingLabel = '매물 이름 찾는 중'
const invalidLabel = '주소 확인 필요'
const failedLabel = '매물 이름을 확인하지 못했어요'

const createItemId = (index: number) => `listing-${index + 1}`

const getListingLabel = (listing: TruckListing) =>
  listing.vname || listing.vehicleName || listing.vnumber || '확인된 매물'

const updateByUrl = (
  items: PreparedListing[],
  url: string,
  update: (item: PreparedListing) => PreparedListing
) => items.map((item) => (item.url === url ? update(item) : item))

const updateById = (
  items: PreparedListing[],
  id: string,
  update: (item: PreparedListing) => PreparedListing
) => items.map((item) => (item.id === id ? update(item) : item))

export const selectReadyPreparedListings = (state: PreparedListingState) =>
  state.items.filter(
    (item): item is PreparedListing & { status: 'ready'; listing: TruckListing } =>
      item.status === 'ready' && Boolean(item.listing)
  )

export const selectSavedPreparedListings = (state: PreparedListingState) =>
  state.items.filter((item) => item.status === 'saved')

export const selectCheckingPreparedListings = (state: PreparedListingState) =>
  state.items.filter((item) => item.status === 'checking')

export const createPreparedListingStore = (): StoreApi<PreparedListingState> =>
  createStore<PreparedListingState>((set, get) => ({
    items: [],
    addUrls: (urls) => {
      const currentUrls = new Set(get().items.map((item) => item.url))
      const added: string[] = []
      const duplicates: string[] = []

      for (const url of urls) {
        if (currentUrls.has(url)) {
          duplicates.push(url)
          continue
        }

        currentUrls.add(url)
        added.push(url)
      }

      set((state) => {
        const offset = state.items.length
        const newItems = added.map<PreparedListing>((url, index) => ({
          id: createItemId(offset + index),
          url,
          status: 'checking',
          label: checkingLabel,
        }))

        return {
          items: [...state.items, ...newItems],
        }
      })

      return { added, duplicates }
    },
    markReady: (url, listing) =>
      set((state) => ({
        items: updateByUrl(state.items, url, (item) => ({
          ...item,
          status: 'ready',
          label: getListingLabel(listing),
          listing,
          message: undefined,
        })),
      })),
    markInvalid: (url, message) =>
      set((state) => ({
        items: updateByUrl(state.items, url, (item) => ({
          ...item,
          status: 'invalid',
          label: invalidLabel,
          message,
        })),
      })),
    markFailed: (url, message) =>
      set((state) => ({
        items: updateByUrl(state.items, url, (item) => ({
          ...item,
          status: 'failed',
          label: failedLabel,
          message,
        })),
      })),
    markSaving: (id, progress) =>
      set((state) => ({
        items: updateById(state.items, id, (item) => ({
          ...item,
          status: 'saving',
          downloadedImages: progress.downloadedImages,
          totalImages: progress.totalImages,
          progress: progress.progress,
        })),
      })),
    markSaved: (id) =>
      set((state) => ({
        items: updateById(state.items, id, (item) => {
          const totalImages = item.totalImages ?? item.listing?.images.length ?? 0

          return {
            ...item,
            status: 'saved',
            downloadedImages: totalImages,
            totalImages,
            progress: 100,
          }
        }),
      })),
    remove: (id) =>
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),
    reset: () => set({ items: [] }),
  }))
```

Create `src/v2/features/listing-preparation/index.ts`.

```ts
export {
  createPreparedListingStore,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
  selectSavedPreparedListings,
} from './model/prepared-listing-store'
export type {
  AddPreparedUrlsResult,
  PreparedListing,
  PreparedListingProgress,
  PreparedListingState,
  PreparedListingStatus,
} from './model/prepared-listing-store'
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/features/listing-preparation
git commit -m "feat: v2 매물 준비 상태 저장소 추가"
```

## Task 3: Automatic Listing Preview Runner

**Files:**

- Create: `src/v2/features/listing-preparation/model/prepare-listings.ts`
- Create: `src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts`
- Modify: `src/v2/features/listing-preparation/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts`.

```ts
import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { prepareListingUrls } from '../prepare-listings'
import { createPreparedListingStore } from '../prepared-listing-store'

const buildUrl = (id: number) =>
  `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=${id}`

const createListing = (url: string, id: number): TruckListing => ({
  url,
  vname: `[활어차]포터2 ${id}`,
  vehicleName: `[활어차]포터2 ${id}`,
  vnumber: `서울${String(id).padStart(2, '0')}가1234`,
  price: {
    raw: 3550,
    rawWon: 35500000,
    label: '3,550만원',
    compactLabel: '3.6천만',
  },
  year: '2020',
  mileage: '150,000km',
  options: '냉동탑 / 후방카메라',
  images: [],
})

describe('prepareListingUrls', () => {
  it('adds urls and marks successful previews ready', async () => {
    const store = createPreparedListingStore()
    const firstUrl = buildUrl(1)
    const secondUrl = buildUrl(2)
    const parse = vi.fn(async (url: string) => createListing(url, url.endsWith('1') ? 1 : 2))

    await prepareListingUrls({
      urls: [firstUrl, secondUrl],
      store,
      parse,
    })

    expect(parse).toHaveBeenCalledTimes(2)
    expect(store.getState().items).toMatchObject([
      { status: 'ready', label: '[활어차]포터2 1' },
      { status: 'ready', label: '[활어차]포터2 2' },
    ])
  })

  it('does not preview duplicate urls again', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(1)
    const parse = vi.fn(async () => createListing(url, 1))

    await prepareListingUrls({ urls: [url], store, parse })
    await prepareListingUrls({ urls: [url], store, parse })

    expect(parse).toHaveBeenCalledTimes(1)
    expect(store.getState().items).toHaveLength(1)
  })

  it('marks failed previews with Korean recovery copy', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(1)

    await prepareListingUrls({
      urls: [url],
      store,
      parse: async () => {
        throw new Error('network failed')
      },
    })

    expect(store.getState().items[0]).toMatchObject({
      status: 'failed',
      label: '매물 이름을 확인하지 못했어요',
      message: '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.',
    })
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts
```

Expected: FAIL because `prepare-listings.ts` does not exist.

- [ ] **Step 3: Implement the runner**

Create `src/v2/features/listing-preparation/model/prepare-listings.ts`.

```ts
import { type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'
import { parseTruckListing } from '@/v2/features/truck-processing'
import { runConcurrent } from '@/v2/shared/lib/concurrency'

import { type PreparedListingState } from './prepared-listing-store'

const defaultConcurrency = 5
const previewFailureMessage = '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.'

export interface PrepareListingUrlsInput {
  urls: readonly string[]
  store: StoreApi<PreparedListingState>
  concurrency?: number
  signal?: AbortSignal
  parse?: (url: string, signal?: AbortSignal) => Promise<TruckListing>
}

export async function prepareListingUrls({
  urls,
  store,
  concurrency = defaultConcurrency,
  signal,
  parse = (url, requestSignal) => parseTruckListing({ url, signal: requestSignal }),
}: PrepareListingUrlsInput) {
  const { added, duplicates } = store.getState().addUrls(urls)

  await runConcurrent({
    items: added,
    limit: concurrency,
    signal,
    task: async (url) => {
      try {
        const listing = await parse(url, signal)
        store.getState().markReady(url, listing)
      } catch {
        store.getState().markFailed(url, previewFailureMessage)
      }
    },
  })

  return {
    added,
    duplicates,
  }
}
```

Update `src/v2/features/listing-preparation/index.ts`.

```ts
export { prepareListingUrls } from './model/prepare-listings'
export type { PrepareListingUrlsInput } from './model/prepare-listings'
export {
  createPreparedListingStore,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
  selectSavedPreparedListings,
} from './model/prepared-listing-store'
export type {
  AddPreparedUrlsResult,
  PreparedListing,
  PreparedListingProgress,
  PreparedListingState,
  PreparedListingStatus,
} from './model/prepared-listing-store'
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/features/listing-preparation
git commit -m "feat: v2 매물 이름 자동 확인 추가"
```

## Task 4: Notion-Style Listing Chip Input UI

**Files:**

- Create: `src/v2/widgets/url-input/ui/listing-chip-input.tsx`
- Create: `src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx`
- Modify: `src/v2/widgets/url-input/index.ts`
- Modify: `src/v2/shared/lib/copy.ts`

- [ ] **Step 1: Write the failing UI tests**

Create `src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx`.

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { type PreparedListing } from '@/v2/features/listing-preparation'

import { ListingChipInput } from '../listing-chip-input'

const readyItem: PreparedListing = {
  id: 'listing-1',
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
  status: 'ready',
  label: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
}

const checkingItem: PreparedListing = {
  id: 'listing-2',
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4',
  status: 'checking',
  label: '매물 이름 찾는 중',
}

const failedItem: PreparedListing = {
  id: 'listing-3',
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=5',
  status: 'failed',
  label: '매물 이름을 확인하지 못했어요',
  message: '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.',
}

describe('ListingChipInput', () => {
  it('renders simple Korean paste guidance and listing chips', () => {
    const html = renderToStaticMarkup(
      <ListingChipInput
        disabled={false}
        duplicateMessage={null}
        items={[readyItem, checkingItem, failedItem]}
        onPasteText={vi.fn()}
        onRemove={vi.fn()}
        onStart={vi.fn()}
      />
    )

    expect(html).toContain('매물 주소 넣기')
    expect(html).toContain('복사한 내용을 그대로 붙여넣으세요')
    expect(html).toContain('[활어차]포터2 슈퍼캡/초장축/(CRDi)')
    expect(html).toContain('매물 이름 찾는 중')
    expect(html).toContain('지우고 다시 붙여넣어 주세요')
  })

  it('uses a ready-count start label and hides remove buttons while disabled', () => {
    const html = renderToStaticMarkup(
      <ListingChipInput
        disabled
        duplicateMessage={null}
        items={[readyItem]}
        onPasteText={vi.fn()}
        onRemove={vi.fn()}
        onStart={vi.fn()}
      />
    )

    expect(html).toContain('확인된 1대 저장 시작')
    expect(html).not.toContain('매물 지우기')
  })

  it('explains duplicate pasted listings in plain Korean', () => {
    const html = renderToStaticMarkup(
      <ListingChipInput
        disabled={false}
        duplicateMessage="이미 넣은 매물이에요."
        items={[readyItem]}
        onPasteText={vi.fn()}
        onRemove={vi.fn()}
        onStart={vi.fn()}
      />
    )

    expect(html).toContain('이미 넣은 매물이에요.')
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun run test -- --run src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx
```

Expected: FAIL because `listing-chip-input.tsx` does not exist.

- [ ] **Step 3: Implement the chip input component**

Create `src/v2/widgets/url-input/ui/listing-chip-input.tsx`.

```tsx
'use client'

import { Check, Loader2, X, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

import { type PreparedListing } from '@/v2/features/listing-preparation'
import { v2Copy } from '@/v2/shared/lib/copy'
import { Button } from '@/v2/shared/ui/button'

interface ListingChipInputProps {
  items: readonly PreparedListing[]
  disabled: boolean
  duplicateMessage: string | null
  onPasteText: (text: string) => void
  onRemove: (id: string) => void
  onStart: () => void
}

const chipToneClass: Record<PreparedListing['status'], string> = {
  checking: 'bg-muted text-muted-foreground border-border',
  ready: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  invalid: 'bg-red-50 text-red-900 border-red-200',
  failed: 'bg-red-50 text-red-900 border-red-200',
  saving: 'bg-blue-50 text-blue-900 border-blue-200',
  saved: 'bg-emerald-50 text-emerald-900 border-emerald-200',
}

function ListingChipIcon({ status }: { status: PreparedListing['status'] }) {
  if (status === 'checking' || status === 'saving') {
    return <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
  }

  if (status === 'invalid' || status === 'failed') {
    return <AlertTriangle aria-hidden="true" className="size-3.5" />
  }

  return <Check aria-hidden="true" className="size-3.5" />
}

function getStartLabel(items: readonly PreparedListing[]) {
  const readyCount = items.filter((item) => item.status === 'ready').length
  const checkingCount = items.filter((item) => item.status === 'checking').length

  if (checkingCount > 0) {
    return '매물 이름 확인 중'
  }

  if (readyCount === 0) {
    return '매물 주소를 넣어주세요'
  }

  return `확인된 ${readyCount}대 저장 시작`
}

export function ListingChipInput({
  items,
  disabled,
  duplicateMessage,
  onPasteText,
  onRemove,
  onStart,
}: ListingChipInputProps) {
  const [draftText, setDraftText] = useState('')
  const readyCount = items.filter((item) => item.status === 'ready').length
  const checkingCount = items.filter((item) => item.status === 'checking').length
  const canStart = readyCount > 0 && checkingCount === 0 && !disabled

  return (
    <section
      aria-labelledby="listing-chip-input-title"
      className="border-border bg-card text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
      data-tour="url-input"
    >
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold" id="listing-chip-input-title">
          {v2Copy.urlInput.title}
        </h2>
        <p className="text-muted-foreground text-sm">{v2Copy.urlInput.description}</p>
      </div>

      <div className="border-input bg-background focus-within:border-ring focus-within:ring-ring/50 min-h-36 rounded-lg border px-3 py-2 shadow-xs transition-colors focus-within:ring-3">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              className={`${chipToneClass[item.status]} inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium`}
              key={item.id}
            >
              <ListingChipIcon status={item.status} />
              <span className="max-w-72 truncate">{item.label}</span>
              {!disabled ? (
                <button
                  aria-label={`매물 지우기: ${item.label}`}
                  className="rounded-sm p-0.5 hover:bg-black/10"
                  onClick={() => onRemove(item.id)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </span>
          ))}
          <textarea
            aria-label="매물 주소"
            className="placeholder:text-muted-foreground min-h-12 min-w-56 flex-1 resize-none bg-transparent text-sm outline-none"
            disabled={disabled}
            onChange={(event) => setDraftText(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text')
              event.preventDefault()
              setDraftText('')
              onPasteText(text)
            }}
            placeholder="복사한 내용을 여기에 붙여넣으세요"
            value={draftText}
          />
        </div>
      </div>

      <div aria-live="polite" className="grid gap-1">
        {duplicateMessage ? (
          <p className="text-muted-foreground text-sm">{duplicateMessage}</p>
        ) : null}
        {items.some((item) => item.status === 'failed' || item.status === 'invalid') ? (
          <p className="text-destructive text-sm">
            확인하지 못한 매물은 지우고 다시 붙여넣어 주세요.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button disabled={!canStart} onClick={onStart} type="button">
          {getStartLabel(items)}
        </Button>
      </div>
    </section>
  )
}
```

Update `src/v2/shared/lib/copy.ts`.

```ts
export const v2Copy = {
  urlInput: {
    title: '매물 주소 넣기',
    description: '복사한 내용을 그대로 붙여넣으세요. 매물 주소만 자동으로 찾습니다.',
    label: '매물 주소',
    placeholder: '복사한 내용을 여기에 붙여넣으세요',
    submit: '가져오기 시작',
    errors: {
      empty: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
      invalid: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    },
  },
  // Keep the rest of the existing v2Copy object unchanged.
} as const
```

The code block above shows the `urlInput` section only. When editing the actual file, replace only the `urlInput` object and leave `urlList`, `directorySelector`, `processingStatus`, and `attentionPanel` in place.

Update `src/v2/widgets/url-input/index.ts`.

```ts
export * from './model'
export * from './ui/listing-chip-input'
export * from './ui/url-input-form'
export * from './ui/url-list'
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
bun run test -- --run src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/widgets/url-input src/v2/shared/lib/copy.ts
git commit -m "feat: v2 매물 칩 입력 ui 추가"
```

## Task 5: Prepared Listing Progress Panel

**Files:**

- Create: `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`
- Create: `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`
- Modify: `src/v2/widgets/processing-status/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`.

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { type PreparedListing } from '@/v2/features/listing-preparation'

import { PreparedListingStatusPanel } from '../prepared-listing-status'

const items: PreparedListing[] = [
  {
    id: 'listing-1',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
    status: 'saved',
    label: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
    downloadedImages: 18,
    totalImages: 18,
    progress: 100,
  },
  {
    id: 'listing-2',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4',
    status: 'saving',
    label: '[카고]마이티',
    downloadedImages: 12,
    totalImages: 18,
    progress: 67,
  },
  {
    id: 'listing-3',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=5',
    status: 'failed',
    label: '매물 이름을 확인하지 못했어요',
    message: '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.',
  },
]

describe('PreparedListingStatusPanel', () => {
  it('renders user-readable labels and completion summary without internal ids', () => {
    const html = renderToStaticMarkup(<PreparedListingStatusPanel items={items} />)

    expect(html).toContain('오늘 작업')
    expect(html).toContain('3대 중 1대 저장 완료')
    expect(html).toContain('[활어차]포터2 슈퍼캡/초장축/(CRDi)')
    expect(html).toContain('[카고]마이티')
    expect(html).toContain('사진 12/18')
    expect(html).not.toContain('truck-1')
  })

  it('shows a strong all-done summary when every ready listing is saved', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel
        items={[
          { ...items[0], id: 'listing-1', status: 'saved' },
          { ...items[1], id: 'listing-2', status: 'saved', progress: 100 },
        ]}
      />
    )

    expect(html).toContain('2대 저장 완료')
    expect(html).toContain('data-complete-summary="true"')
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun run test -- --run src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx
```

Expected: FAIL because `prepared-listing-status.tsx` does not exist.

- [ ] **Step 3: Implement the panel**

Create `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`.

```tsx
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

import { type PreparedListing } from '@/v2/features/listing-preparation'

interface PreparedListingStatusPanelProps {
  items: readonly PreparedListing[]
}

const statusLabel: Record<PreparedListing['status'], string> = {
  checking: '확인 중',
  ready: '저장 준비 완료',
  invalid: '주소 확인 필요',
  failed: '확인 필요',
  saving: '저장 중',
  saved: '저장 완료',
}

function StatusIcon({ status }: { status: PreparedListing['status'] }) {
  if (status === 'saved' || status === 'ready') {
    return <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-700" />
  }

  if (status === 'saving' || status === 'checking') {
    return <Loader2 aria-hidden="true" className="size-4 animate-spin text-blue-700" />
  }

  return <AlertTriangle aria-hidden="true" className="size-4 text-red-700" />
}

export function PreparedListingStatusPanel({ items }: PreparedListingStatusPanelProps) {
  const savedCount = items.filter((item) => item.status === 'saved').length
  const actionableCount = items.filter((item) =>
    ['ready', 'saving', 'saved'].includes(item.status)
  ).length
  const allDone = actionableCount > 0 && savedCount === actionableCount

  return (
    <section
      aria-labelledby="prepared-status-title"
      className="border-border bg-card text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
      data-tour="processing-status"
    >
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold" id="prepared-status-title">
          오늘 작업
        </h2>
        <p
          className={
            allDone
              ? 'rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900'
              : 'text-muted-foreground text-sm'
          }
          data-complete-summary={allDone ? 'true' : undefined}
        >
          {allDone ? `${savedCount}대 저장 완료` : `${items.length}대 중 ${savedCount}대 저장 완료`}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
          아직 준비된 매물이 없습니다.
        </p>
      ) : (
        <ul className="grid gap-2" role="list">
          {items.map((item) => (
            <li
              className="border-border bg-background grid gap-2 rounded-lg border px-3 py-2"
              key={item.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <StatusIcon status={item.status} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs">
                  {statusLabel[item.status]}
                </span>
              </div>
              {item.status === 'saving' ? (
                <p className="text-muted-foreground text-xs">
                  사진 {item.downloadedImages ?? 0}/{item.totalImages ?? 0}
                </p>
              ) : null}
              {item.message ? <p className="text-destructive text-xs">{item.message}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

Update `src/v2/widgets/processing-status/index.ts`.

```ts
export * from './ui/attention-panel'
export * from './ui/prepared-listing-status'
export * from './ui/processing-status'
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
bun run test -- --run src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/widgets/processing-status
git commit -m "feat: v2 매물명 진행 상황 패널 추가"
```

## Task 6: Optional Desktop Completion Notifications

**Files:**

- Create: `src/v2/features/completion-notification/model/completion-notification.ts`
- Create: `src/v2/features/completion-notification/model/__tests__/completion-notification.test.ts`
- Create: `src/v2/features/completion-notification/ui/completion-notification-toggle.tsx`
- Create: `src/v2/features/completion-notification/ui/__tests__/completion-notification-toggle.test.tsx`
- Create: `src/v2/features/completion-notification/index.ts`

- [ ] **Step 1: Write failing notification helper tests**

Create `src/v2/features/completion-notification/model/__tests__/completion-notification.test.ts`.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isCompletionNotificationAvailable,
  notifyCompletion,
  requestCompletionNotificationPermission,
} from '../completion-notification'

describe('completion notification helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports unavailable when Notification is missing', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('Notification', undefined)

    expect(isCompletionNotificationAvailable()).toBe(false)
  })

  it('requests notification permission when available', async () => {
    const requestPermission = vi.fn(async () => 'granted')
    vi.stubGlobal('window', {})
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })

    await expect(requestCompletionNotificationPermission()).resolves.toBe('granted')
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('sends completion notification only when permission is granted', () => {
    const notification = vi.fn()
    vi.stubGlobal('window', {})
    vi.stubGlobal('Notification', Object.assign(notification, { permission: 'granted' }))

    notifyCompletion(4)

    expect(notification).toHaveBeenCalledWith('트럭 매물 4대 저장이 끝났습니다.')
  })

  it('does nothing when permission is denied', () => {
    const notification = vi.fn()
    vi.stubGlobal('window', {})
    vi.stubGlobal('Notification', Object.assign(notification, { permission: 'denied' }))

    notifyCompletion(4)

    expect(notification).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run helper tests and verify RED**

Run:

```bash
bun run test -- --run src/v2/features/completion-notification/model/__tests__/completion-notification.test.ts
```

Expected: FAIL because the notification helper does not exist.

- [ ] **Step 3: Implement notification helpers**

Create `src/v2/features/completion-notification/model/completion-notification.ts`.

```ts
export function isCompletionNotificationAvailable() {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined'
}

export async function requestCompletionNotificationPermission() {
  if (!isCompletionNotificationAvailable()) {
    return 'denied' as NotificationPermission
  }

  return Notification.requestPermission()
}

export function notifyCompletion(count: number) {
  if (!isCompletionNotificationAvailable()) {
    return
  }

  if (Notification.permission !== 'granted') {
    return
  }

  new Notification(`트럭 매물 ${count}대 저장이 끝났습니다.`)
}
```

- [ ] **Step 4: Write failing toggle UI tests**

Create `src/v2/features/completion-notification/ui/__tests__/completion-notification-toggle.test.tsx`.

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { CompletionNotificationToggle } from '../completion-notification-toggle'

describe('CompletionNotificationToggle', () => {
  it('renders optional notification copy without forcing permission', () => {
    const html = renderToStaticMarkup(
      <CompletionNotificationToggle isAvailable permission="default" onEnable={vi.fn()} />
    )

    expect(html).toContain('완료 알림 켜기')
    expect(html).toContain('선택 사항')
  })

  it('renders enabled copy after permission is granted', () => {
    const html = renderToStaticMarkup(
      <CompletionNotificationToggle isAvailable permission="granted" onEnable={vi.fn()} />
    )

    expect(html).toContain('완료 알림 켜짐')
  })

  it('renders denied copy in plain Korean', () => {
    const html = renderToStaticMarkup(
      <CompletionNotificationToggle isAvailable permission="denied" onEnable={vi.fn()} />
    )

    expect(html).toContain('브라우저 알림이 꺼져 있습니다')
  })
})
```

- [ ] **Step 5: Run toggle tests and verify RED**

Run:

```bash
bun run test -- --run src/v2/features/completion-notification/ui/__tests__/completion-notification-toggle.test.tsx
```

Expected: FAIL because the toggle component does not exist.

- [ ] **Step 6: Implement toggle UI and exports**

Create `src/v2/features/completion-notification/ui/completion-notification-toggle.tsx`.

```tsx
'use client'

import { Bell } from 'lucide-react'

import { Button } from '@/v2/shared/ui/button'

interface CompletionNotificationToggleProps {
  isAvailable: boolean
  permission: NotificationPermission | 'unsupported'
  onEnable: () => void
}

export function CompletionNotificationToggle({
  isAvailable,
  permission,
  onEnable,
}: CompletionNotificationToggleProps) {
  if (!isAvailable || permission === 'unsupported') {
    return null
  }

  if (permission === 'granted') {
    return (
      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
        <Bell aria-hidden="true" className="size-4" />
        완료 알림 켜짐
      </p>
    )
  }

  if (permission === 'denied') {
    return <p className="text-muted-foreground text-sm">브라우저 알림이 꺼져 있습니다</p>
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={onEnable} size="sm" type="button" variant="outline">
        <Bell aria-hidden="true" data-icon="inline-start" />
        완료 알림 켜기
      </Button>
      <span className="text-muted-foreground text-xs">선택 사항</span>
    </div>
  )
}
```

Create `src/v2/features/completion-notification/index.ts`.

```ts
export {
  isCompletionNotificationAvailable,
  notifyCompletion,
  requestCompletionNotificationPermission,
} from './model/completion-notification'
export { CompletionNotificationToggle } from './ui/completion-notification-toggle'
```

- [ ] **Step 7: Run helper and toggle tests and verify GREEN**

Run:

```bash
bun run test -- --run src/v2/features/completion-notification/model/__tests__/completion-notification.test.ts src/v2/features/completion-notification/ui/__tests__/completion-notification-toggle.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/v2/features/completion-notification
git commit -m "feat: v2 저장 완료 알림 선택 기능 추가"
```

## Task 7: Wire The v2 App To Prepared Listings

**Files:**

- Modify: `src/app/v2/truck-harvester-v2-app.tsx`
- Test: existing targeted tests from Tasks 2-6

- [ ] **Step 1: Write failing app-level test**

Modify `src/app/v2/__tests__/page.test.tsx` by replacing the second test assertions with the new copy.

```tsx
it('renders the chip-input workbench instead of url list scaffolding', () => {
  const html = renderToStaticMarkup(<V2Page />)

  expect(html).toContain('매물 주소 넣기')
  expect(html).toContain('복사한 내용을 그대로 붙여넣으세요')
  expect(html).toContain('오늘 작업')
  expect(html).toContain('저장 폴더 선택')
  expect(html).toContain('도움말')
  expect(html).not.toContain('가져올 매물')
  expect(html).not.toContain('truck-1')
})
```

- [ ] **Step 2: Run app-level test and verify RED**

Run:

```bash
bun run test -- --run src/app/v2/__tests__/page.test.tsx
```

Expected: FAIL because the page still renders the old `가져올 매물` URL list.

- [ ] **Step 3: Wire stores and paste preview**

Modify `src/app/v2/truck-harvester-v2-app.tsx` imports.

```ts
import { useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'

import {
  createPreparedListingStore,
  prepareListingUrls,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
  type PreparedListing,
} from '@/v2/features/listing-preparation'
import {
  CompletionNotificationToggle,
  isCompletionNotificationAvailable,
  notifyCompletion,
  requestCompletionNotificationPermission,
} from '@/v2/features/completion-notification'
import { ListingChipInput } from '@/v2/widgets/url-input'
import { PreparedListingStatusPanel } from '@/v2/widgets/processing-status'
```

Inside `TruckHarvesterV2App`, add prepared-listing store state.

```ts
const [preparedStore] = useState(() => createPreparedListingStore())
const preparedState = useStore(preparedStore, (state) => state)
const readyItems = selectReadyPreparedListings(preparedState)
const checkingItems = selectCheckingPreparedListings(preparedState)
const [isSaving, setIsSaving] = useState(false)
const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null)
const [notificationPermission, setNotificationPermission] = useState<
  NotificationPermission | 'unsupported'
>('unsupported')
const notificationAvailable = useMemo(() => isCompletionNotificationAvailable(), [])
```

Add notification initialization.

```ts
useEffect(() => {
  if (!notificationAvailable) {
    setNotificationPermission('unsupported')
    return
  }

  setNotificationPermission(Notification.permission)
}, [notificationAvailable])
```

Add paste handler.

```ts
const pasteListings = async (text: string) => {
  const result = parseUrlInputText(text)

  if (!result.success) {
    setDuplicateMessage(result.message)
    return
  }

  const { duplicates } = await prepareListingUrls({
    urls: result.urls,
    store: preparedStore,
  })

  setDuplicateMessage(duplicates.length > 0 ? '이미 넣은 매물이에요.' : null)
}
```

Keep `parseUrlInputText` imported from `@/v2/widgets/url-input`.

- [ ] **Step 4: Wire save flow to prepared items**

Replace the old `startBatch(urls: string[])` path with a no-argument `startSavingReadyListings`.

```ts
const savePreparedListing = async (
  item: PreparedListing & { listing: TruckListing },
  signal: AbortSignal,
  targetDirectory: WritableDirectoryHandle | null
) => {
  if (!targetDirectory) {
    return
  }

  preparedStore.getState().markSaving(item.id, {
    downloadedImages: 0,
    totalImages: item.listing.images.length,
    progress: 0,
  })

  await saveTruckToDirectory(targetDirectory, item.listing, {
    signal,
    onProgress: (progress, downloadedImages, totalImages) => {
      preparedStore.getState().markSaving(item.id, {
        progress,
        downloadedImages,
        totalImages,
      })
    },
  })

  preparedStore.getState().markSaved(item.id)
}

const startSavingReadyListings = async () => {
  if (readyItems.length === 0 || checkingItems.length > 0) {
    return
  }

  const controller = new AbortController()
  const runDirectory = await resolveSaveDirectoryForRun()

  if (runDirectory === undefined) {
    return
  }

  setIsSaving(true)

  try {
    for (const item of readyItems) {
      await savePreparedListing(item, controller.signal, runDirectory)
    }

    notifyCompletion(readyItems.length)
  } finally {
    setIsSaving(false)
  }
}
```

Remove the old `enteredUrls`, `batchStore`, `attentionItems`, `startBatch`, `retryItem`, `skipItem`, `UrlInputForm`, `UrlList`, `ProcessingStatus`, and `AttentionPanel` usage from the v2 page. Leave the old components in their files for now; this task only rewires the page.

- [ ] **Step 5: Render the new workbench**

Update the page body in `TruckHarvesterV2App`.

```tsx
<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
  <div className="grid content-start gap-5">
    <ListingChipInput
      disabled={isSaving}
      duplicateMessage={duplicateMessage}
      items={preparedState.items}
      onPasteText={(text) => void pasteListings(text)}
      onRemove={(id) => preparedStore.getState().remove(id)}
      onStart={() => void startSavingReadyListings()}
    />
  </div>

  <div className="grid content-start gap-5">
    <DirectorySelector
      isSupported
      onSelectDirectory={(nextDirectory) => setDirectory(nextDirectory)}
      selectedDirectoryName={directory?.name}
    />
    <CompletionNotificationToggle
      isAvailable={notificationAvailable}
      permission={notificationPermission}
      onEnable={() => {
        void requestCompletionNotificationPermission().then((permission) =>
          setNotificationPermission(permission)
        )
      }}
    />
    <PreparedListingStatusPanel items={preparedState.items} />
  </div>
</div>
```

- [ ] **Step 6: Run app-level and targeted tests and verify GREEN**

Run:

```bash
bun run test -- --run src/app/v2/__tests__/page.test.tsx src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts src/v2/features/completion-notification/model/__tests__/completion-notification.test.ts src/v2/features/completion-notification/ui/__tests__/completion-notification-toggle.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/v2/truck-harvester-v2-app.tsx src/app/v2/__tests__/page.test.tsx
git commit -m "feat: v2 칩 입력 작업판 연결"
```

## Task 8: E2E Coverage For Chip Workbench

**Files:**

- Modify: `e2e/happy-path-batch.spec.ts`
- Create: `e2e/chip-input-workbench.spec.ts`
- Modify: `e2e/a11y.spec.ts` only if selectors or initial state need updating

- [ ] **Step 1: Write the failing chip-workbench E2E**

Create `e2e/chip-input-workbench.spec.ts`.

```ts
import { expect, test } from '@playwright/test'

const onboardingStorageKey = 'truck-harvester:v2:onboarding'

const firstUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=1'
const secondUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=2'

test('turns pasted chat text into listing chips and saves ready listings', async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
      window.showDirectoryPicker = async () =>
        ({
          name: 'truck-test',
          async getDirectoryHandle() {
            return {
              async getFileHandle() {
                return {
                  async createWritable() {
                    return {
                      async write() {
                        return undefined
                      },
                      async close() {
                        return undefined
                      },
                    }
                  },
                }
              },
            }
          },
        }) as unknown as FileSystemDirectoryHandle
    },
    [onboardingStorageKey, 'completed']
  )

  await page.route('**/api/v2/parse-truck', async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as { url: string }
    const id = new URL(body.url).searchParams.get('OnCarNo') ?? '1'

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          url: body.url,
          vname: `[활어차]포터2 슈퍼캡 ${id}`,
          vehicleName: `[활어차]포터2 슈퍼캡 ${id}`,
          vnumber: `서울${id.padStart(2, '0')}가1234`,
          price: {
            raw: 3550,
            rawWon: 35500000,
            label: '3,550만원',
            compactLabel: '3.6천만',
          },
          year: '2020',
          mileage: '150,000km',
          options: '냉동탑 / 후방카메라',
          images: [],
        },
      }),
    })
  })

  await page.goto('/v2')
  await page.getByLabel('매물 주소').fill(' ')
  await page.getByLabel('매물 주소').dispatchEvent('paste', {
    clipboardData: {
      getData: () => `사장님 확인 부탁드립니다 ${firstUrl}\n문자에 같이 온 주소 ${secondUrl}`,
    },
  })

  await expect(page.getByText('[활어차]포터2 슈퍼캡 1')).toBeVisible()
  await expect(page.getByText('[활어차]포터2 슈퍼캡 2')).toBeVisible()
  await expect(page.getByRole('button', { name: '확인된 2대 저장 시작' })).toBeEnabled()

  await page.getByRole('button', { name: '확인된 2대 저장 시작' }).click()

  await expect(page.getByText('2대 저장 완료')).toBeVisible()
  await expect(page.getByText('truck-1')).toHaveCount(0)
})
```

If Playwright cannot synthesize `clipboardData` with `dispatchEvent`, replace the paste step with `page.evaluate` that dispatches a real `ClipboardEvent`. Use this exact fallback:

```ts
await page.evaluate(
  ({ firstUrl, secondUrl }) => {
    const textarea = document.querySelector(
      'textarea[aria-label="매물 주소"]'
    ) as HTMLTextAreaElement
    const data = new DataTransfer()
    data.setData(
      'text/plain',
      `사장님 확인 부탁드립니다 ${firstUrl}\n문자에 같이 온 주소 ${secondUrl}`
    )
    textarea.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    )
  },
  { firstUrl, secondUrl }
)
```

- [ ] **Step 2: Run E2E and verify RED**

Run:

```bash
bun run test:e2e -- e2e/chip-input-workbench.spec.ts
```

Expected before Task 7 is complete: FAIL because the chip input is not wired. Expected after Task 7: PASS.

- [ ] **Step 3: Update existing happy path**

Modify `e2e/happy-path-batch.spec.ts` to paste mixed text into the chip input and assert saved listing labels instead of `truck-10`. Use the same `showDirectoryPicker` stub already in that file.

Replace the old fill/click assertions with:

```ts
const mixedText = urls.map((url, index) => `매물 ${index + 1}: ${url}`).join('\n')

await page.getByLabel('매물 주소').dispatchEvent('paste', {
  clipboardData: {
    getData: () => mixedText,
  },
})

await expect(page.getByText('현대 마이티 10')).toBeVisible()
await page.getByRole('button', { name: '확인된 10대 저장 시작' }).click()
await expect(page.getByText('10대 저장 완료')).toBeVisible()
await expect(page.getByText('주목 필요')).toHaveCount(0)
```

If `dispatchEvent('paste')` does not pass clipboard data, use the `page.evaluate` fallback from Step 1 with `mixedText`.

- [ ] **Step 4: Run E2E and verify GREEN**

Run:

```bash
bun run test:e2e -- e2e/chip-input-workbench.spec.ts e2e/happy-path-batch.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run accessibility smoke test**

Run:

```bash
bun run test:a11y
```

Expected: PASS. If it fails on missing accessible names, fix the relevant label or aria text in the chip input and rerun.

- [ ] **Step 6: Commit**

```bash
git add e2e/chip-input-workbench.spec.ts e2e/happy-path-batch.spec.ts e2e/a11y.spec.ts src/v2/widgets/url-input/ui/listing-chip-input.tsx
git commit -m "test: v2 칩 입력 작업판 e2e 추가"
```

## Task 9: Final Verification And Documentation Sync

**Files:**

- Modify: `docs/superpowers/specs/2026-04-26-v2-chip-input-workbench-design.md` only if implementation decisions changed during execution
- Modify: `docs/architecture.md` only if the v2 architecture summary currently lists the old URL-list flow
- Modify: `docs/runbooks/add-widget.md` only if new widget patterns need documenting
- Modify: `src/v2/testing/__tests__/knowledge-base.test.ts` only if docs inventory requires updates

- [ ] **Step 1: Run full unit tests**

Run:

```bash
bun run test -- --run
```

Expected: PASS with all Vitest files passing.

- [ ] **Step 2: Run typecheck, lint, and format check**

Run:

```bash
bun run typecheck
bun run lint
bun run format:check
```

Expected: all commands PASS.

- [ ] **Step 3: Run E2E and a11y checks**

Run:

```bash
bun run test:e2e -- e2e/chip-input-workbench.spec.ts e2e/happy-path-batch.spec.ts
bun run test:a11y
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
bun run build
```

Expected: PASS. Existing legacy Sentry deprecation and `z-index` warnings may still appear; do not fix them in this task because they are tracked separately.

- [ ] **Step 5: Browser smoke check**

Run the dev server if it is not already running:

```bash
bun run dev
```

Open `http://localhost:3000/v2` and verify:

- The page shows `매물 주소 넣기`.
- The old `가져올 매물` URL list is gone.
- Pasted mixed text creates chips.
- Successful chips show listing names.
- The start button says `확인된 N대 저장 시작`.
- Completion appears inside the page, not as a modal.

- [ ] **Step 6: Commit docs-only follow-up if docs changed**

If Task 9 changed docs or tests, commit them:

```bash
git add docs src/v2/testing
git commit -m "docs: v2 칩 입력 작업판 문서 동기화"
```

If no docs or test inventory changed, do not create an empty commit.

## Self-Review

### Spec Coverage

- Arbitrary pasted text URL extraction: Task 1.
- Immediate `checking` chips and preview fetching: Tasks 2 and 3.
- Notion-style chips with `x` before start: Task 4.
- Failed/invalid recovery by `지우기 -> 다시 붙여넣기`: Tasks 2 and 4.
- No in-progress cancellation: Tasks 4 and 7 keep removal disabled during save; issue #8 remains follow-up.
- Save only `ready` listings: Task 7.
- User-readable progress labels with no `truck-1`: Task 5 and Task 8.
- Non-modal completion summary: Task 5.
- Optional desktop notifications: Task 6.
- Accessibility: Tasks 4, 5, 8, and 9.
- Legacy scope fence, no Sentry, no watermark: Scope And Guardrails plus Task 9 verification.

### Placeholder Scan

The plan contains no `TBD`, no open-ended implementation placeholders, and no intentionally incomplete code blocks. Each implementation task includes exact files, test snippets, commands, and commit commands.

### Type Consistency

The plan consistently uses:

- `PreparedListing`
- `PreparedListingState`
- `createPreparedListingStore`
- `prepareListingUrls`
- `ListingChipInput`
- `PreparedListingStatusPanel`
- `CompletionNotificationToggle`
- `extractTruckUrlsFromText`

These names match across tests, implementation snippets, app wiring, and exports.
