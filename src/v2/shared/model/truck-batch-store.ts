import { createStore, type StoreApi } from 'zustand/vanilla'

import { type FailedTruck, type TruckListing } from '@/v2/entities/truck'

export interface PendingBatchItem {
  status: 'pending'
  id: string
  url: string
}

export interface ParsingBatchItem {
  status: 'parsing'
  id: string
  url: string
  startedAt: string
}

export interface ParsedBatchItem {
  status: 'parsed'
  id: string
  url: string
  listing: TruckListing
  parsedAt: string
}

export interface DownloadingBatchItem {
  status: 'downloading'
  id: string
  url: string
  listing?: TruckListing
  downloadedImages: number
  totalImages: number
  progress: number
}

export interface DownloadedBatchItem {
  status: 'downloaded'
  id: string
  url: string
  listing?: TruckListing
  downloadedImages: number
  totalImages: number
  progress: 100
  completedAt: string
}

export interface FailedBatchItem {
  status: 'failed'
  id: string
  url: string
  reason: FailedTruck['reason']
  message: string
  failedAt: string
}

export interface SkippedBatchItem {
  status: 'skipped'
  id: string
  url: string
  reason: string
  skippedAt: string
}

export type TruckBatchItem =
  | PendingBatchItem
  | ParsingBatchItem
  | ParsedBatchItem
  | DownloadingBatchItem
  | DownloadedBatchItem
  | FailedBatchItem
  | SkippedBatchItem

export interface DownloadProgressInput {
  downloadedImages: number
  totalImages: number
  progress: number
}

export interface FailureInput {
  reason: FailedTruck['reason']
  message: string
}

export interface TruckBatchState {
  items: TruckBatchItem[]
  addUrls: (urls: string[]) => void
  setParsing: (id: string) => void
  setParsed: (id: string, listing: TruckListing) => void
  setDownloading: (id: string, progress: DownloadProgressInput) => void
  setDownloaded: (id: string) => void
  setFailed: (id: string, failure: FailureInput) => void
  setSkipped: (id: string, reason: string) => void
  retry: (id: string) => void
  reset: () => void
}

const missingItemMessage = '작업 항목을 찾을 수 없습니다.'

const timestamp = () => new Date().toISOString()

const createItemId = (index: number) => `truck-${index + 1}`

const withExistingItem = (
  items: TruckBatchItem[],
  id: string,
  update: (item: TruckBatchItem) => TruckBatchItem
) => {
  let found = false

  const nextItems = items.map((item) => {
    if (item.id !== id) {
      return item
    }

    found = true
    return update(item)
  })

  if (!found) {
    throw new Error(missingItemMessage)
  }

  return nextItems
}

const getListing = (item: TruckBatchItem) =>
  'listing' in item ? item.listing : undefined

const getDownloadTotal = (item: TruckBatchItem) => {
  if ('totalImages' in item) {
    return item.totalImages
  }

  return getListing(item)?.images.length ?? 0
}

export const createTruckBatchStore = (): StoreApi<TruckBatchState> =>
  createStore<TruckBatchState>((set) => ({
    items: [],
    addUrls: (urls) =>
      set((state) => {
        const offset = state.items.length
        const newItems = urls.map<PendingBatchItem>((url, index) => ({
          status: 'pending',
          id: createItemId(offset + index),
          url,
        }))

        return { items: [...state.items, ...newItems] }
      }),
    setParsing: (id) =>
      set((state) => ({
        items: withExistingItem(state.items, id, (item) => ({
          status: 'parsing',
          id: item.id,
          url: item.url,
          startedAt: timestamp(),
        })),
      })),
    setParsed: (id, listing) =>
      set((state) => ({
        items: withExistingItem(state.items, id, (item) => ({
          status: 'parsed',
          id: item.id,
          url: item.url,
          listing,
          parsedAt: timestamp(),
        })),
      })),
    setDownloading: (id, progress) =>
      set((state) => ({
        items: withExistingItem(state.items, id, (item) => ({
          status: 'downloading',
          id: item.id,
          url: item.url,
          listing: getListing(item),
          downloadedImages: progress.downloadedImages,
          totalImages: progress.totalImages,
          progress: progress.progress,
        })),
      })),
    setDownloaded: (id) =>
      set((state) => ({
        items: withExistingItem(state.items, id, (item) => {
          const totalImages = getDownloadTotal(item)

          return {
            status: 'downloaded',
            id: item.id,
            url: item.url,
            listing: getListing(item),
            downloadedImages: totalImages,
            totalImages,
            progress: 100,
            completedAt: timestamp(),
          }
        }),
      })),
    setFailed: (id, failure) =>
      set((state) => ({
        items: withExistingItem(state.items, id, (item) => ({
          status: 'failed',
          id: item.id,
          url: item.url,
          reason: failure.reason,
          message: failure.message,
          failedAt: timestamp(),
        })),
      })),
    setSkipped: (id, reason) =>
      set((state) => ({
        items: withExistingItem(state.items, id, (item) => ({
          status: 'skipped',
          id: item.id,
          url: item.url,
          reason,
          skippedAt: timestamp(),
        })),
      })),
    retry: (id) =>
      set((state) => ({
        items: withExistingItem(state.items, id, (item) => ({
          status: 'pending',
          id: item.id,
          url: item.url,
        })),
      })),
    reset: () => set({ items: [] }),
  }))
