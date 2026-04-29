import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createAnalyticsBatchId,
  toBatchEventData,
  toListingFailureEventData,
  trackBatchStarted,
  trackListingFailed,
} from '../analytics'

const originalWindow = globalThis.window

function stubWindow(value: unknown) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
  })
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
  vi.restoreAllMocks()
})

describe('analytics payload builders', () => {
  it('creates stable-looking batch ids without user identifiers', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

    expect(createAnalyticsBatchId()).toBe('batch-loyw3v28-4fzzzx')
  })

  it('builds batch event data with aggregate fields only', () => {
    const data = toBatchEventData({
      batchId: 'batch-1',
      urlCount: 3,
      uniqueUrlCount: 2,
      readyCount: 1,
      invalidCount: 1,
      previewFailedCount: 0,
      savedCount: 1,
      saveFailedCount: 0,
      durationMs: 1234,
      saveMethod: 'directory',
      filesystemSupported: true,
      notificationEnabled: false,
    })

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
    expect(data).not.toHaveProperty('listing_url')
    expect(data).not.toHaveProperty('vehicle_number')
    expect(data).not.toHaveProperty('vehicle_name')
  })

  it('omits optional failure fields when the listing was never parsed', () => {
    expect(
      toListingFailureEventData({
        batchId: 'batch-1',
        failureStage: 'preview',
        failureReason: '매물 이름을 확인하지 못했어요',
        listingUrl:
          'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
        elapsedMs: 900,
      })
    ).toEqual({
      batch_id: 'batch-1',
      failure_stage: 'preview',
      failure_reason: '매물 이름을 확인하지 못했어요',
      listing_url:
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
      elapsed_ms: 900,
    })
  })

  it('includes vehicle identifiers for parsed listings that fail during save', () => {
    expect(
      toListingFailureEventData({
        batchId: 'batch-1',
        failureStage: 'save',
        failureReason: '저장하지 못했어요',
        listingUrl:
          'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
        vehicleNumber: '서울12가3456',
        vehicleName: '현대 메가트럭',
        imageCount: 2,
        elapsedMs: 1500,
      })
    ).toEqual({
      batch_id: 'batch-1',
      failure_stage: 'save',
      failure_reason: '저장하지 못했어요',
      listing_url:
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
      vehicle_number: '서울12가3456',
      vehicle_name: '현대 메가트럭',
      image_count: 2,
      elapsed_ms: 1500,
    })
  })
})

describe('analytics tracking', () => {
  it('does nothing when the Umami tracker is missing', () => {
    stubWindow({})

    expect(() =>
      trackBatchStarted({
        batchId: 'batch-1',
        urlCount: 1,
        uniqueUrlCount: 1,
        readyCount: 0,
        invalidCount: 0,
        previewFailedCount: 0,
        savedCount: 0,
        saveFailedCount: 0,
        durationMs: 0,
        filesystemSupported: true,
        notificationEnabled: false,
      })
    ).not.toThrow()
  })

  it('sends named events with event data to Umami', () => {
    const track = vi.fn()
    stubWindow({ umami: { track } })

    trackListingFailed({
      batchId: 'batch-1',
      failureStage: 'invalid_url',
      failureReason: '매물 정보를 찾지 못했어요',
      listingUrl:
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
      elapsedMs: 300,
    })

    expect(track).toHaveBeenCalledWith('listing_failed', {
      batch_id: 'batch-1',
      failure_stage: 'invalid_url',
      failure_reason: '매물 정보를 찾지 못했어요',
      listing_url:
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
      elapsed_ms: 300,
    })
  })

  it('swallows tracker errors so the app flow can continue', () => {
    stubWindow({
      umami: {
        track: vi.fn(() => {
          throw new Error('blocked')
        }),
      },
    })

    expect(() =>
      trackListingFailed({
        batchId: 'batch-1',
        failureStage: 'preview',
        failureReason: 'network',
        listingUrl:
          'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
        elapsedMs: 1,
      })
    ).not.toThrow()
  })
})
