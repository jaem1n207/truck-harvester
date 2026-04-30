import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it.each([
    [Number.NaN, '00_under_1s'],
    [Number.POSITIVE_INFINITY, '00_under_1s'],
    [-1, '00_under_1s'],
    [0, '00_under_1s'],
    [999, '00_under_1s'],
    [999.5, '00_under_1s'],
    [1000, '01_1s'],
    [1999, '01_1s'],
    [1999.9, '01_1s'],
    [2000, '02_2s'],
    [6420, '06_6s'],
    [9999, '09_9s'],
    [9999.9, '09_9s'],
    [10000, '10_10s_plus'],
    [15320, '10_10s_plus'],
  ])('maps %s ms to %s', (durationMs, bucket) => {
    expect(toDurationBucket(durationMs)).toBe(bucket)
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
      duration_bucket: '01_1s',
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

  it('builds a bounded unsupported input failure payload', () => {
    const failure = toUnsupportedInputFailureInput({
      batchId: 'batch-unsupported',
      rawInput: '  DetailView.asp?ShopNo=30195108\n\tabc...  ',
      elapsedMs: 12,
    })

    expect(failure).toEqual({
      batchId: 'batch-unsupported',
      failureStage: 'invalid_url',
      failureReason: 'unsupported_input',
      listingUrl: 'DetailView.asp?ShopNo=30195108 abc...',
      inputWasTruncated: false,
      elapsedMs: 12,
    })
    expect(toListingFailureEventData(failure!)).toEqual({
      batch_id: 'batch-unsupported',
      failure_stage: 'invalid_url',
      failure_reason: 'unsupported_input',
      listing_url: 'DetailView.asp?ShopNo=30195108 abc...',
      input_was_truncated: false,
      elapsed_ms: 12,
    })
  })

  it('truncates unsupported input samples to 160 characters', () => {
    const rawInput = `DetailView.asp?${'x'.repeat(200)}`
    const failure = toUnsupportedInputFailureInput({
      batchId: 'batch-long',
      rawInput,
      elapsedMs: 20,
    })

    expect(failure?.listingUrl).toBe(rawInput.slice(0, 160))
    expect(failure?.listingUrl).toHaveLength(160)
    expect(failure?.inputWasTruncated).toBe(true)
  })

  it('does not build unsupported input payloads for empty samples', () => {
    expect(
      toUnsupportedInputFailureInput({
        batchId: 'batch-empty',
        rawInput: ' \n\t ',
        elapsedMs: 1,
      })
    ).toBeNull()
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

  it('sends duration bucket with save_completed event data', () => {
    const track = vi.fn()
    stubWindow({ umami: { track } })

    trackSaveCompleted({
      batchId: 'batch-1',
      urlCount: 4,
      uniqueUrlCount: 4,
      readyCount: 4,
      invalidCount: 0,
      previewFailedCount: 0,
      savedCount: 4,
      saveFailedCount: 0,
      durationMs: 6420,
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

  it('tracks unsupported input through the listing_failed event', () => {
    const track = vi.fn()
    stubWindow({ umami: { track } })

    trackUnsupportedInputFailure({
      batchId: 'batch-unsupported',
      rawInput: '  DetailView.asp?ShopNo=1\nabc...  ',
      elapsedMs: 7,
    })

    expect(track).toHaveBeenCalledWith('listing_failed', {
      batch_id: 'batch-unsupported',
      failure_stage: 'invalid_url',
      failure_reason: 'unsupported_input',
      listing_url: 'DetailView.asp?ShopNo=1 abc...',
      input_was_truncated: false,
      elapsed_ms: 7,
    })
  })

  it('does not send unsupported input events for empty samples', () => {
    const track = vi.fn()
    stubWindow({ umami: { track } })

    trackUnsupportedInputFailure({
      batchId: 'batch-empty',
      rawInput: ' \n\t ',
      elapsedMs: 0,
    })

    expect(track).not.toHaveBeenCalled()
  })
})
