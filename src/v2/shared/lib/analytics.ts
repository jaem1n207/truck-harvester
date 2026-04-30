type AnalyticsEventDataValue = string | number | boolean
type AnalyticsEventData = Record<string, AnalyticsEventDataValue>

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: AnalyticsEventData) => unknown
    }
  }
}

export type SaveMethod = 'directory' | 'zip'
export type FailureStage = 'invalid_url' | 'preview' | 'save'

export interface BatchAnalyticsInput {
  batchId: string
  urlCount: number
  uniqueUrlCount: number
  readyCount: number
  invalidCount: number
  previewFailedCount: number
  savedCount: number
  saveFailedCount: number
  durationMs: number
  saveMethod?: SaveMethod
  filesystemSupported: boolean
  notificationEnabled: boolean
}

export interface ListingFailureAnalyticsInput {
  batchId: string
  failureStage: FailureStage
  failureReason: string
  listingUrl: string
  vehicleNumber?: string
  vehicleName?: string
  imageCount?: number
  inputWasTruncated?: boolean
  elapsedMs: number
}

export interface UnsupportedInputFailureAnalyticsInput {
  batchId: string
  rawInput: string
  elapsedMs: number
}

type OptionalAnalyticsEventData = Record<
  string,
  AnalyticsEventDataValue | undefined
>

const unsupportedInputFailureReason = 'unsupported_input'
const unsupportedInputSampleMaxLength = 160
const whitespacePattern = /\s+/g

const compactEventData = (data: OptionalAnalyticsEventData) =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as AnalyticsEventData

const trackEvent = (eventName: string, data: OptionalAnalyticsEventData) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.umami?.track(eventName, compactEventData(data))
  } catch {
    // Analytics must never interrupt the dealership workflow.
  }
}

export function createAnalyticsBatchId() {
  return `batch-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function toDurationBucket(durationMs: number) {
  const normalizedDurationMs = Number.isFinite(durationMs)
    ? Math.max(0, durationMs)
    : 0

  if (normalizedDurationMs < 1000) {
    return '00_under_1s'
  }

  const seconds = Math.floor(normalizedDurationMs / 1000)

  if (seconds >= 10) {
    return '10_10s_plus'
  }

  const paddedSeconds = seconds.toString().padStart(2, '0')

  return `${paddedSeconds}_${seconds}s`
}

export function toBatchEventData(input: BatchAnalyticsInput) {
  return compactEventData({
    batch_id: input.batchId,
    url_count: input.urlCount,
    unique_url_count: input.uniqueUrlCount,
    ready_count: input.readyCount,
    invalid_count: input.invalidCount,
    preview_failed_count: input.previewFailedCount,
    saved_count: input.savedCount,
    save_failed_count: input.saveFailedCount,
    duration_ms: input.durationMs,
    duration_bucket: toDurationBucket(input.durationMs),
    save_method: input.saveMethod,
    filesystem_supported: input.filesystemSupported,
    notification_enabled: input.notificationEnabled,
  })
}

export function toListingFailureEventData(input: ListingFailureAnalyticsInput) {
  return compactEventData({
    batch_id: input.batchId,
    failure_stage: input.failureStage,
    failure_reason: input.failureReason,
    listing_url: input.listingUrl,
    vehicle_number: input.vehicleNumber,
    vehicle_name: input.vehicleName,
    image_count: input.imageCount,
    input_was_truncated: input.inputWasTruncated,
    elapsed_ms: input.elapsedMs,
  })
}

export function toUnsupportedInputFailureInput({
  batchId,
  rawInput,
  elapsedMs,
}: UnsupportedInputFailureAnalyticsInput): ListingFailureAnalyticsInput | null {
  const normalizedInput = rawInput.trim().replace(whitespacePattern, ' ')

  if (normalizedInput.length === 0) {
    return null
  }

  return {
    batchId,
    failureStage: 'invalid_url',
    failureReason: unsupportedInputFailureReason,
    listingUrl: normalizedInput.slice(0, unsupportedInputSampleMaxLength),
    inputWasTruncated: normalizedInput.length > unsupportedInputSampleMaxLength,
    elapsedMs,
  }
}

export const trackBatchStarted = (input: BatchAnalyticsInput) => {
  trackEvent('batch_started', toBatchEventData(input))
}

export const trackPreviewCompleted = (input: BatchAnalyticsInput) => {
  trackEvent('preview_completed', toBatchEventData(input))
}

export const trackSaveStarted = (input: BatchAnalyticsInput) => {
  trackEvent('save_started', toBatchEventData(input))
}

export const trackSaveCompleted = (input: BatchAnalyticsInput) => {
  trackEvent('save_completed', toBatchEventData(input))
}

export const trackSaveFailed = (input: BatchAnalyticsInput) => {
  trackEvent('save_failed', toBatchEventData(input))
}

export const trackListingFailed = (input: ListingFailureAnalyticsInput) => {
  trackEvent('listing_failed', toListingFailureEventData(input))
}

export const trackUnsupportedInputFailure = (
  input: UnsupportedInputFailureAnalyticsInput
) => {
  const failureInput = toUnsupportedInputFailureInput(input)

  if (!failureInput) {
    return
  }

  trackListingFailed(failureInput)
}
