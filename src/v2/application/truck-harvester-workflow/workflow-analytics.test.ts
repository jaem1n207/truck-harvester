import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'
import { type TruckSaveResult } from '@/v2/features/file-management'

import { createWorkflowAnalytics } from './workflow-analytics'

const firstUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
const secondUrl = `${firstUrl}&copy=2`
const thirdUrl = `${firstUrl}&copy=3`

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

const createSaveResult = (
  overrides: Partial<TruckSaveResult> = {}
): TruckSaveResult => ({
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

  it('tracks preview start and completion using aggregate counts and failure stages', () => {
    const transport = createTransport()
    const tracker = createWorkflowAnalytics({
      createBatchId: () => 'batch-preview',
      getFilesystemSupported: () => false,
      getNotificationEnabled: () => true,
      now: () => 100,
      transport,
    })

    const batch = tracker.previewStarted({ urlCount: 3, startedAt: 25 })

    tracker.previewCompleted({
      batch,
      items: [
        { id: 'listing-1', url: firstUrl, status: 'ready' },
        {
          id: 'listing-2',
          url: secondUrl,
          status: 'failed',
          message: '매물 이름을 확인하지 못했어요.',
        },
        {
          id: 'listing-3',
          url: thirdUrl,
          status: 'invalid',
          message: '지원하지 않는 주소예요.',
        },
      ],
    })

    expect(transport.trackBatchStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
        urlCount: 3,
        uniqueUrlCount: 3,
        readyCount: 0,
        filesystemSupported: false,
        notificationEnabled: true,
      })
    )
    expect(transport.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
        urlCount: 3,
        uniqueUrlCount: 3,
        readyCount: 1,
        invalidCount: 1,
        previewFailedCount: 1,
        filesystemSupported: false,
        notificationEnabled: true,
      })
    )
    expect(transport.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
        failureStage: 'preview',
        listingUrl: secondUrl,
      })
    )
    expect(transport.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
        failureStage: 'invalid_url',
        listingUrl: thirdUrl,
      })
    )
  })

  it('tracks save batches separately by original preview batch', () => {
    const transport = createTransport()
    const tracker = createWorkflowAnalytics({
      createBatchId: vi
        .fn()
        .mockReturnValueOnce('batch-save-first')
        .mockReturnValueOnce('batch-save-second'),
      getFilesystemSupported: () => true,
      getNotificationEnabled: () => false,
      now: () => 200,
      transport,
    })
    const firstBatch = tracker.previewStarted({ urlCount: 1, startedAt: 100 })
    const secondBatch = tracker.previewStarted({
      urlCount: 1,
      startedAt: 125,
    })

    tracker.previewCompleted({
      batch: firstBatch,
      items: [{ id: 'listing-1', url: firstUrl, status: 'ready' }],
    })
    tracker.previewCompleted({
      batch: secondBatch,
      items: [{ id: 'listing-2', url: secondUrl, status: 'ready' }],
    })
    tracker.saveStarted({
      items: [
        { id: 'listing-1', url: firstUrl, listing },
        {
          id: 'listing-2',
          url: secondUrl,
          listing: { ...listing, url: secondUrl, vnumber: '부산34나7890' },
        },
      ],
      saveMethod: 'directory',
    })
    tracker.saveListingFailed({
      item: {
        id: 'listing-2',
        url: secondUrl,
        listing: { ...listing, url: secondUrl, vnumber: '부산34나7890' },
      },
      message: '저장하지 못했어요.',
    })
    tracker.saveSettled({
      items: [
        { id: 'listing-1', url: firstUrl, listing },
        {
          id: 'listing-2',
          url: secondUrl,
          listing: { ...listing, url: secondUrl, vnumber: '부산34나7890' },
        },
      ],
      saveMethod: 'directory',
      savedItemIds: new Set(['listing-1']),
      saveResultsByItemId: new Map(),
    })

    expect(transport.trackSaveStarted).toHaveBeenCalledTimes(2)
    expect(transport.trackSaveStarted).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        batchId: 'batch-save-first',
        readyCount: 1,
        saveMethod: 'directory',
      })
    )
    expect(transport.trackSaveStarted).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        batchId: 'batch-save-second',
        readyCount: 1,
        saveMethod: 'directory',
      })
    )
    expect(transport.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-save-second',
        failureStage: 'save',
        listingUrl: secondUrl,
        vehicleNumber: '부산34나7890',
        vehicleName: '현대 메가트럭',
        imageCount: 1,
      })
    )
    expect(transport.trackSaveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-save-first',
        savedCount: 1,
        saveFailedCount: 0,
      })
    )
    expect(transport.trackSaveFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-save-second',
        savedCount: 0,
        saveFailedCount: 1,
      })
    )
  })

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

  it('clears previous save failures when the same listing is retried successfully', () => {
    const transport = createTransport()
    const tracker = createWorkflowAnalytics({
      createBatchId: () => 'batch-retry-save',
      getFilesystemSupported: () => true,
      getNotificationEnabled: () => false,
      now: () => 250,
      transport,
    })
    const batch = tracker.previewStarted({ urlCount: 1, startedAt: 100 })
    const item = { id: 'listing-1', url: firstUrl, listing }

    tracker.previewCompleted({
      batch,
      items: [{ id: item.id, url: item.url, status: 'ready' }],
    })
    tracker.saveStarted({
      items: [item],
      saveMethod: 'directory',
    })
    tracker.saveListingFailed({
      item,
      message: '저장하지 못했어요.',
    })
    tracker.saveSettled({
      items: [item],
      saveMethod: 'directory',
      savedItemIds: new Set(),
      saveResultsByItemId: new Map(),
    })

    tracker.saveStarted({
      items: [item],
      saveMethod: 'directory',
    })
    tracker.saveSettled({
      items: [item],
      saveMethod: 'directory',
      savedItemIds: new Set([item.id]),
      saveResultsByItemId: new Map(),
    })

    expect(transport.trackSaveFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-retry-save',
        savedCount: 0,
        saveFailedCount: 1,
      })
    )
    expect(transport.trackSaveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-retry-save',
        savedCount: 1,
        saveFailedCount: 0,
      })
    )
  })

  it('removes listing analytics state when a chip is removed', () => {
    const transport = createTransport()
    const createBatchId = vi
      .fn()
      .mockReturnValueOnce('batch-original')
      .mockReturnValueOnce('batch-fallback')
    const tracker = createWorkflowAnalytics({
      createBatchId,
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
        batchId: 'batch-fallback',
        saveMethod: 'zip',
      })
    )
    expect(batch.id).toBe('batch-original')
    expect(createBatchId).toHaveBeenCalledTimes(2)
  })
})
