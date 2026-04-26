import {
  type DownloadedBatchItem,
  type FailedBatchItem,
  type ParsingBatchItem,
  type SkippedBatchItem,
  type TruckBatchState,
  type TruckBatchItem,
} from './truck-batch-store'

export type InProgressBatchItem =
  | ParsingBatchItem
  | Extract<TruckBatchItem, { status: 'downloading' }>

export type DoneBatchItem = DownloadedBatchItem | SkippedBatchItem

const terminalStatuses = new Set<TruckBatchItem['status']>([
  'downloaded',
  'failed',
  'skipped',
])

export const selectAttentionNeeded = (
  state: TruckBatchState
): FailedBatchItem[] =>
  state.items.filter(
    (item): item is FailedBatchItem => item.status === 'failed'
  )

export const selectInProgress = (
  state: TruckBatchState
): InProgressBatchItem[] =>
  state.items.filter(
    (item): item is InProgressBatchItem =>
      item.status === 'parsing' || item.status === 'downloading'
  )

export const selectDone = (state: TruckBatchState): DoneBatchItem[] =>
  state.items.filter(
    (item): item is DoneBatchItem =>
      item.status === 'downloaded' || item.status === 'skipped'
  )

export const selectAllResolved = (state: TruckBatchState) =>
  state.items.length > 0 &&
  state.items.every((item) => terminalStatuses.has(item.status))
