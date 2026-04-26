import { createStore, type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'

export type PreparedListingStatus =
  | 'checking'
  | 'ready'
  | 'invalid'
  | 'failed'
  | 'saving'
  | 'saved'

export interface CheckingPreparedListing {
  status: 'checking'
  id: string
  url: string
  label: string
}

export interface ReadyPreparedListing {
  status: 'ready'
  id: string
  url: string
  label: string
  listing: TruckListing
}

export interface InvalidPreparedListing {
  status: 'invalid'
  id: string
  url: string
  label: string
  message: string
}

export interface FailedPreparedListing {
  status: 'failed'
  id: string
  url: string
  label: string
  message: string
}

export interface SavingPreparedListing {
  status: 'saving'
  id: string
  url: string
  label: string
  listing?: TruckListing
  downloadedImages: number
  totalImages: number
  progress: number
}

export interface SavedPreparedListing {
  status: 'saved'
  id: string
  url: string
  label: string
  listing?: TruckListing
  downloadedImages: number
  totalImages: number
  progress: 100
}

export type PreparedListing =
  | CheckingPreparedListing
  | ReadyPreparedListing
  | InvalidPreparedListing
  | FailedPreparedListing
  | SavingPreparedListing
  | SavedPreparedListing

export interface AddPreparedUrlsResult {
  added: string[]
  duplicates: string[]
}

export interface PreparedListingSaveProgress {
  downloadedImages: number
  totalImages: number
  progress: number
}

export interface PreparedListingState {
  items: PreparedListing[]
  nextId: number
  addUrls: (urls: string[]) => AddPreparedUrlsResult
  markReady: (url: string, listing: TruckListing) => void
  markInvalid: (url: string, message: string) => void
  markFailed: (url: string, message: string) => void
  markSaving: (id: string, progress: PreparedListingSaveProgress) => void
  markSaved: (id: string) => void
  remove: (id: string) => void
  reset: () => void
}

const checkingLabel = '매물 이름 찾는 중'
const invalidLabel = '주소 확인 필요'
const failedLabel = '매물 이름을 확인하지 못했어요'
const defaultReadyLabel = '확인된 매물'

const createItemId = (index: number) => `listing-${index}`

const listingLabel = (listing: TruckListing) =>
  listing.vname || listing.vehicleName || listing.vnumber || defaultReadyLabel

const getListing = (item: PreparedListing) =>
  'listing' in item ? item.listing : undefined

const getSavedTotalImages = (item: PreparedListing) => {
  if ('totalImages' in item) {
    return item.totalImages
  }

  return getListing(item)?.images.length ?? 0
}

const updateByUrl = (
  items: PreparedListing[],
  url: string,
  update: (item: PreparedListing) => PreparedListing
) => items.map((item) => (item.url === url ? update(item) : item))

const updateById = (
  items: PreparedListing[],
  id: string,
  update: (item: PreparedListing) => PreparedListing
) => items.map((item) => (item.id === id ? update(item) : item))

const isReadyPreparedListing = (
  item: PreparedListing
): item is ReadyPreparedListing =>
  item.status === 'ready' && Boolean(item.listing)

const isSavedPreparedListing = (
  item: PreparedListing
): item is SavedPreparedListing => item.status === 'saved'

const isCheckingPreparedListing = (
  item: PreparedListing
): item is CheckingPreparedListing => item.status === 'checking'

export const createPreparedListingStore = (): StoreApi<PreparedListingState> =>
  createStore<PreparedListingState>((set, get) => ({
    items: [],
    nextId: 1,
    addUrls: (urls) => {
      const { items, nextId } = get()
      const seenUrls = new Set(items.map((item) => item.url))
      const added: string[] = []
      const duplicates: string[] = []
      let nextIndex = nextId

      const newItems = urls.reduce<CheckingPreparedListing[]>((acc, url) => {
        if (seenUrls.has(url)) {
          duplicates.push(url)
          return acc
        }

        seenUrls.add(url)
        added.push(url)
        acc.push({
          status: 'checking',
          id: createItemId(nextIndex),
          url,
          label: checkingLabel,
        })
        nextIndex += 1

        return acc
      }, [])

      if (newItems.length > 0) {
        set({ items: [...items, ...newItems], nextId: nextIndex })
      }

      return { added, duplicates }
    },
    markReady: (url, listing) =>
      set((state) => ({
        items: updateByUrl(state.items, url, (item) => ({
          status: 'ready',
          id: item.id,
          url: item.url,
          label: listingLabel(listing),
          listing,
        })),
      })),
    markInvalid: (url, message) =>
      set((state) => ({
        items: updateByUrl(state.items, url, (item) => ({
          status: 'invalid',
          id: item.id,
          url: item.url,
          label: invalidLabel,
          message,
        })),
      })),
    markFailed: (url, message) =>
      set((state) => ({
        items: updateByUrl(state.items, url, (item) => ({
          status: 'failed',
          id: item.id,
          url: item.url,
          label: failedLabel,
          message,
        })),
      })),
    markSaving: (id, progress) =>
      set((state) => ({
        items: updateById(state.items, id, (item) => ({
          status: 'saving',
          id: item.id,
          url: item.url,
          label: item.label,
          listing: getListing(item),
          downloadedImages: progress.downloadedImages,
          totalImages: progress.totalImages,
          progress: progress.progress,
        })),
      })),
    markSaved: (id) =>
      set((state) => ({
        items: updateById(state.items, id, (item) => {
          const totalImages = getSavedTotalImages(item)

          return {
            status: 'saved',
            id: item.id,
            url: item.url,
            label: item.label,
            listing: getListing(item),
            downloadedImages: totalImages,
            totalImages,
            progress: 100,
          }
        }),
      })),
    remove: (id) =>
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),
    reset: () => set({ items: [], nextId: 1 }),
  }))

export const selectReadyPreparedListings = (
  state: PreparedListingState
): ReadyPreparedListing[] => state.items.filter(isReadyPreparedListing)

export const selectSavedPreparedListings = (
  state: PreparedListingState
): SavedPreparedListing[] => state.items.filter(isSavedPreparedListing)

export const selectCheckingPreparedListings = (
  state: PreparedListingState
): CheckingPreparedListing[] => state.items.filter(isCheckingPreparedListing)
