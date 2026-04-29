import { type TruckListing } from '@/v2/entities/truck'
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
  unsupportedInputFailed: (event: {
    rawInput: string
    startedAt: number
  }) => void
  previewStarted: (event: {
    urlCount: number
    startedAt: number
  }) => AnalyticsBatchRef
  previewCompleted: (event: {
    batch: AnalyticsBatchRef
    items: readonly WorkflowPreviewItem[]
  }) => void
  saveStarted: (event: {
    items: readonly WorkflowSaveItem[]
    saveMethod: SaveMethod
  }) => void
  saveListingFailed: (event: {
    item: WorkflowSaveItem
    message: string
  }) => void
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

  return (
    trimmedValue.length > 0 &&
    trimmedValue !== missingListingIdentityPlaceholder
  )
}

const getSaveFailureVehicleName = (listing: TruckListing) =>
  [listing.vname, listing.vehicleName].find(isUsableListingIdentity) ||
  listing.vname ||
  listing.vehicleName

export function createWorkflowAnalytics({
  createBatchId = createAnalyticsBatchId,
  getFilesystemSupported,
  getNotificationEnabled,
  now = () =>
    typeof performance !== 'undefined' ? performance.now() : Date.now(),
  transport = defaultTransport,
}: CreateWorkflowAnalyticsInput): WorkflowTracker {
  const batchByListingId = new Map<string, AnalyticsBatchRef>()
  const saveFailureIds = new Set<string>()

  const createBatch = (
    urlCount: number,
    startedAt: number
  ): AnalyticsBatchRef => ({
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

  const toReadyPreviewItems = (
    items: readonly WorkflowSaveItem[]
  ): WorkflowPreviewItem[] =>
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

  const getSaveCounts = (
    group: SaveBatchGroup,
    savedItemIds: ReadonlySet<string>
  ) => ({
    savedCount: group.items.filter((item) => savedItemIds.has(item.id)).length,
    saveFailedCount: group.items.filter((item) => saveFailureIds.has(item.id))
      .length,
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

      transport.trackBatchStarted(
        toBatchInput(batch, [], { uniqueUrlCount: urlCount })
      )

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
        const input = toBatchInput(
          group.batch,
          toReadyPreviewItems(group.items),
          {
            ...counts,
            saveMethod,
          }
        )

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
