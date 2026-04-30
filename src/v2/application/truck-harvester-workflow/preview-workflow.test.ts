import { describe, expect, it, vi } from 'vitest'
import { type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'
import {
  createPreparedListingStore,
  type PreparedListingState,
} from '@/v2/features/listing-preparation'

import { runPreviewWorkflow } from './preview-workflow'
import {
  type AnalyticsBatchRef,
  type WorkflowTracker,
} from './workflow-analytics'

const firstUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

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
      duplicateMessage:
        '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
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

  it('does not start preview analytics when already cancelled', async () => {
    const store = createPreparedListingStore()
    const controller = new AbortController()
    const { tracker } = createTracker()

    controller.abort()

    const result = await runWorkflow({
      text: firstUrl,
      store,
      tracker,
      signal: controller.signal,
    })

    expect(result).toEqual({ duplicateMessage: null })
    expect(tracker.previewStarted).not.toHaveBeenCalled()
    expect(tracker.previewCompleted).not.toHaveBeenCalled()
    expect(store.getState().items).toEqual([])
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
            message:
              '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.',
            status: 'failed',
            url: firstUrl,
          },
        ],
      })
    )
  })

  it('does not report preview completion after cancellation', async () => {
    const store = createPreparedListingStore()
    const controller = new AbortController()
    const { tracker } = createTracker()

    const result = await runWorkflow({
      text: firstUrl,
      store,
      tracker,
      signal: controller.signal,
      parse: async () => {
        controller.abort()
        return listing
      },
    })

    expect(result).toEqual({ duplicateMessage: null })
    expect(tracker.previewStarted).toHaveBeenCalledWith({
      urlCount: 1,
      startedAt: 10,
    })
    expect(tracker.previewCompleted).not.toHaveBeenCalled()
  })
})
