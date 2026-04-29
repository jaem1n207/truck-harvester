import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

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
