import { describe, expect, it, vi } from 'vitest'
import { type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'
import { type WritableDirectoryHandle } from '@/v2/features/file-management'
import {
  createPreparedListingStore,
  type PreparedListingState,
  type ReadyPreparedListing,
} from '@/v2/features/listing-preparation'

import { runSaveWorkflow } from './save-workflow'
import { type WorkflowTracker } from './workflow-analytics'

const firstUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

const secondUrl = `${firstUrl}&copy=2`

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

const saveFailureMessage =
  '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'

const createTracker = () =>
  ({
    previewCompleted: vi.fn(),
    previewStarted: vi.fn(),
    removeListing: vi.fn(),
    saveListingFailed: vi.fn(),
    saveSettled: vi.fn(),
    saveStarted: vi.fn(),
    unsupportedInputFailed: vi.fn(),
  }) satisfies WorkflowTracker

const createDirectory = () =>
  ({
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
  }) satisfies WritableDirectoryHandle

const addReadyListings = (
  store: StoreApi<PreparedListingState>,
  listings: readonly TruckListing[] = [listing]
) => {
  store.getState().addUrls(listings.map((item) => item.url))
  listings.forEach((item) => {
    store.getState().markReady(item.url, item)
  })

  return store.getState().items as ReadyPreparedListing[]
}

describe('runSaveWorkflow', () => {
  it('saves ready listings to a directory and settles with saved ids', async () => {
    const store = createPreparedListingStore()
    const items = addReadyListings(store)
    const tracker = createTracker()
    const saveTruckToDirectory = vi.fn(async () => undefined)
    const workflowItem = {
      id: 'listing-1',
      url: firstUrl,
      listing,
    }

    const result = await runSaveWorkflow({
      directory: createDirectory(),
      items,
      saveMethod: 'directory',
      saveTruckToDirectory,
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 1 })
    expect(store.getState().items[0]).toMatchObject({
      status: 'saved',
      id: 'listing-1',
      progress: 100,
    })
    expect(tracker.saveStarted).toHaveBeenCalledWith({
      items: [workflowItem],
      saveMethod: 'directory',
    })
    expect(tracker.saveSettled).toHaveBeenCalledWith({
      items: [workflowItem],
      saveMethod: 'directory',
      savedItemIds: new Set(['listing-1']),
    })
  })

  it('marks directory save failures and reports the failed listing', async () => {
    const store = createPreparedListingStore()
    const items = addReadyListings(store)
    const tracker = createTracker()
    const saveTruckToDirectory = vi.fn(async () => {
      throw new Error('directory unavailable')
    })
    const workflowItem = {
      id: 'listing-1',
      url: firstUrl,
      listing,
    }

    const result = await runSaveWorkflow({
      directory: createDirectory(),
      items,
      saveMethod: 'directory',
      saveTruckToDirectory,
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 0 })
    expect(store.getState().items[0]).toMatchObject({
      status: 'failed',
      id: 'listing-1',
      message: saveFailureMessage,
    })
    expect(tracker.saveListingFailed).toHaveBeenCalledWith({
      item: workflowItem,
      message: saveFailureMessage,
    })
    expect(tracker.saveSettled).toHaveBeenCalledWith({
      items: [workflowItem],
      saveMethod: 'directory',
      savedItemIds: new Set(),
    })
  })

  it('falls back to ZIP saving when no directory is available', async () => {
    const store = createPreparedListingStore()
    const items = addReadyListings(store)
    const tracker = createTracker()
    const downloadTruckZip = vi.fn(async () => undefined)

    const result = await runSaveWorkflow({
      directory: null,
      downloadTruckZip,
      items,
      saveMethod: 'zip',
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 1 })
    expect(downloadTruckZip).toHaveBeenCalledWith([listing], {
      signal: undefined,
      onProgress: expect.any(Function),
    })
    expect(store.getState().items[0]).toMatchObject({
      status: 'saved',
      id: 'listing-1',
      progress: 100,
    })
  })

  it('marks all ready listings failed when ZIP saving fails', async () => {
    const store = createPreparedListingStore()
    const secondListing = {
      ...listing,
      url: secondUrl,
      vnumber: '부산34나7890',
    }
    const items = addReadyListings(store, [listing, secondListing])
    const tracker = createTracker()
    const downloadTruckZip = vi.fn(async () => {
      throw new Error('zip unavailable')
    })

    const result = await runSaveWorkflow({
      downloadTruckZip,
      items,
      saveMethod: 'zip',
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 0 })
    expect(store.getState().items).toMatchObject([
      {
        status: 'failed',
        id: 'listing-1',
        message: saveFailureMessage,
      },
      {
        status: 'failed',
        id: 'listing-2',
        message: saveFailureMessage,
      },
    ])
    expect(tracker.saveListingFailed).toHaveBeenCalledTimes(2)
    expect(tracker.saveListingFailed).toHaveBeenCalledWith({
      item: {
        id: 'listing-1',
        url: firstUrl,
        listing,
      },
      message: saveFailureMessage,
    })
    expect(tracker.saveListingFailed).toHaveBeenCalledWith({
      item: {
        id: 'listing-2',
        url: secondUrl,
        listing: secondListing,
      },
      message: saveFailureMessage,
    })
  })

  it('does not report save settlement or failure after cancellation', async () => {
    const store = createPreparedListingStore()
    const items = addReadyListings(store)
    const tracker = createTracker()
    const controller = new AbortController()
    const saveTruckToDirectory = vi.fn(async () => {
      controller.abort()
      throw new DOMException('다운로드가 취소되었습니다.', 'AbortError')
    })

    const result = await runSaveWorkflow({
      directory: createDirectory(),
      items,
      saveMethod: 'directory',
      saveTruckToDirectory,
      signal: controller.signal,
      store,
      tracker,
    })

    expect(result).toEqual({ savedCount: 0 })
    expect(store.getState().items[0]).toMatchObject({
      status: 'saving',
      id: 'listing-1',
    })
    expect(tracker.saveStarted).toHaveBeenCalled()
    expect(tracker.saveListingFailed).not.toHaveBeenCalled()
    expect(tracker.saveSettled).not.toHaveBeenCalled()
  })
})
