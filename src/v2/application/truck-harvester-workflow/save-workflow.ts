import { type StoreApi } from 'zustand/vanilla'

import {
  downloadTruckZip as defaultDownloadTruckZip,
  saveTruckToDirectory as defaultSaveTruckToDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import {
  type PreparedListingSaveProgress,
  type PreparedListingState,
  type ReadyPreparedListing,
} from '@/v2/features/listing-preparation'
import { type SaveMethod } from '@/v2/shared/lib/analytics'

import {
  type WorkflowSaveItem,
  type WorkflowTracker,
} from './workflow-analytics'

export interface RunSaveWorkflowInput {
  directory?: WritableDirectoryHandle | null
  downloadTruckZip?: typeof defaultDownloadTruckZip
  items: readonly ReadyPreparedListing[]
  saveMethod: SaveMethod
  saveTruckToDirectory?: typeof defaultSaveTruckToDirectory
  signal?: AbortSignal
  store: StoreApi<PreparedListingState>
  tracker: WorkflowTracker
}

export interface RunSaveWorkflowResult {
  savedCount: number
}

const saveFailureMessage =
  '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'

const toWorkflowSaveItem = (item: ReadyPreparedListing): WorkflowSaveItem => ({
  id: item.id,
  url: item.url,
  listing: item.listing,
})

const getInitialProgress = (
  item: ReadyPreparedListing
): PreparedListingSaveProgress => ({
  downloadedImages: 0,
  totalImages: item.listing.images.length,
  progress: 0,
})

const isAborted = (signal?: AbortSignal) => signal?.aborted === true

export async function runSaveWorkflow({
  directory,
  downloadTruckZip = defaultDownloadTruckZip,
  items,
  saveMethod,
  saveTruckToDirectory = defaultSaveTruckToDirectory,
  signal,
  store,
  tracker,
}: RunSaveWorkflowInput): Promise<RunSaveWorkflowResult> {
  let savedCount = 0

  if (isAborted(signal) || items.length === 0) {
    return { savedCount }
  }

  const workflowItems = items.map(toWorkflowSaveItem)
  const savedItemIds = new Set<string>()

  tracker.saveStarted({ items: workflowItems, saveMethod })

  if (saveMethod === 'directory' && directory) {
    for (const [index, item] of items.entries()) {
      if (isAborted(signal)) {
        return { savedCount }
      }

      const workflowItem = workflowItems[index]

      store.getState().markSaving(item.id, getInitialProgress(item))

      try {
        await saveTruckToDirectory(directory, item.listing, {
          signal,
          onProgress: (progress, downloadedImages, totalImages) => {
            if (isAborted(signal)) {
              return
            }

            store.getState().markSaving(item.id, {
              downloadedImages,
              totalImages,
              progress,
            })
          },
        })

        if (isAborted(signal)) {
          return { savedCount }
        }

        store.getState().markSaved(item.id)
        savedItemIds.add(item.id)
        savedCount += 1
      } catch {
        if (isAborted(signal)) {
          return { savedCount }
        }

        tracker.saveListingFailed({
          item: workflowItem,
          message: saveFailureMessage,
        })
        store.getState().markFailed(item.url, saveFailureMessage)
      }
    }
  } else {
    items.forEach((item) => {
      store.getState().markSaving(item.id, getInitialProgress(item))
    })

    try {
      await downloadTruckZip(
        items.map((item) => item.listing),
        {
          signal,
          onProgress: (progress) => {
            if (isAborted(signal)) {
              return
            }

            items.forEach((item) => {
              store.getState().markSaving(item.id, {
                downloadedImages: 0,
                totalImages: item.listing.images.length,
                progress,
              })
            })
          },
        }
      )

      if (isAborted(signal)) {
        return { savedCount }
      }

      items.forEach((item) => {
        store.getState().markSaved(item.id)
        savedItemIds.add(item.id)
      })
      savedCount = items.length
    } catch {
      if (isAborted(signal)) {
        return { savedCount }
      }

      workflowItems.forEach((item) => {
        tracker.saveListingFailed({
          item,
          message: saveFailureMessage,
        })
      })
      items.forEach((item) => {
        store.getState().markFailed(item.url, saveFailureMessage)
      })
    }
  }

  if (isAborted(signal)) {
    return { savedCount }
  }

  tracker.saveSettled({
    items: workflowItems,
    saveMethod,
    savedItemIds,
  })

  return { savedCount }
}
