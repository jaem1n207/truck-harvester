import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { createWorkflowAnalytics } from './workflow-analytics'

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
