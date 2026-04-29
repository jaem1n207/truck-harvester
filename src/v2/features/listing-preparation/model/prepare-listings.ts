import { type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'
import { parseTruckListing } from '@/v2/features/truck-processing'
import { runConcurrent } from '@/v2/shared/lib/concurrency'

import { type PreparedListingState } from './prepared-listing-store'

const defaultConcurrency = 5
const previewFailureMessage =
  '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.'
const missingListingIdentityMessage =
  '매물 정보를 찾지 못했어요. 주소를 다시 확인해 주세요.'
const missingListingIdentityPlaceholder = '차명 정보 없음'

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'

const isMissingListingIdentity = (value: string) => {
  const trimmedValue = value.trim()

  return (
    trimmedValue.length === 0 ||
    trimmedValue === missingListingIdentityPlaceholder
  )
}

const hasUsableListingIdentity = (listing: TruckListing) =>
  !isMissingListingIdentity(listing.vname) ||
  !isMissingListingIdentity(listing.vehicleName)

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

export interface PreparedListingRunItem {
  id: string
  url: string
}

export type PreparedListingSettledItem =
  | (PreparedListingRunItem & { status: 'ready' })
  | (PreparedListingRunItem & { status: 'failed' | 'invalid'; message: string })

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
  const addedItems = result.added.flatMap<PreparedListingRunItem>((url) => {
    const id = addedItemIdsByUrl.get(url)

    return id ? [{ id, url }] : []
  })

  const previewResults = await runConcurrent({
    items: result.added,
    limit: concurrency,
    signal,
    task: async (url): Promise<PreparedListingSettledItem | undefined> => {
      const itemId = addedItemIdsByUrl.get(url)

      if (!itemId) {
        return
      }

      try {
        const listing = await parse(url, signal)
        if (!hasUsableListingIdentity(listing)) {
          store
            .getState()
            .markInvalidById(itemId, missingListingIdentityMessage)
          return {
            id: itemId,
            url,
            status: 'invalid',
            message: missingListingIdentityMessage,
          }
        }

        store.getState().markReadyById(itemId, listing)
        return { id: itemId, url, status: 'ready' }
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }

        store.getState().markFailedById(itemId, previewFailureMessage)
        return {
          id: itemId,
          url,
          status: 'failed',
          message: previewFailureMessage,
        }
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

  const settledItems = previewResults.flatMap((previewResult) =>
    previewResult.status === 'fulfilled' && previewResult.value
      ? [previewResult.value]
      : []
  )

  return { ...result, addedItems, settledItems }
}
