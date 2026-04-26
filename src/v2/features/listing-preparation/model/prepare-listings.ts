import { type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'
import { parseTruckListing } from '@/v2/features/truck-processing'
import { runConcurrent } from '@/v2/shared/lib/concurrency'

import { type PreparedListingState } from './prepared-listing-store'

const defaultConcurrency = 5
const previewFailureMessage =
  '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.'

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'

const findAddedItemIdsByUrl = (
  store: StoreApi<PreparedListingState>,
  urls: readonly string[]
) => {
  const itemIdsByUrl = new Map<string, string>()

  urls.forEach((url) => {
    const item = store
      .getState()
      .items.find((entry) => entry.url === url && entry.status === 'checking')

    if (item) {
      itemIdsByUrl.set(url, item.id)
    }
  })

  return itemIdsByUrl
}

const removeCheckingItemIds = (
  store: StoreApi<PreparedListingState>,
  itemIds: readonly string[]
) => {
  itemIds.forEach((itemId) => {
    const item = store.getState().items.find((entry) => entry.id === itemId)

    if (item?.status === 'checking') {
      store.getState().remove(item.id)
    }
  })
}

export interface PrepareListingUrlsInput {
  urls: readonly string[]
  store: StoreApi<PreparedListingState>
  concurrency?: number
  signal?: AbortSignal
  parse?: (url: string, signal?: AbortSignal) => Promise<TruckListing>
}

export async function prepareListingUrls({
  urls,
  store,
  concurrency = defaultConcurrency,
  signal,
  parse = (url, requestSignal) =>
    parseTruckListing({ url, signal: requestSignal }),
}: PrepareListingUrlsInput) {
  const result = store.getState().addUrls([...urls])
  const addedItemIdsByUrl = findAddedItemIdsByUrl(store, result.added)
  const addedItemIds = [...addedItemIdsByUrl.values()]

  const previewResults = await runConcurrent({
    items: result.added,
    limit: concurrency,
    signal,
    task: async (url) => {
      const itemId = addedItemIdsByUrl.get(url)

      if (!itemId) {
        return
      }

      try {
        const listing = await parse(url, signal)
        store.getState().markReadyById(itemId, listing)
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }

        store.getState().markFailedById(itemId, previewFailureMessage)
      }
    },
  })

  if (
    previewResults.some(
      (previewResult) =>
        previewResult.status === 'rejected' && isAbortError(previewResult.error)
    )
  ) {
    removeCheckingItemIds(store, addedItemIds)
  }

  return result
}
