import { type StoreApi } from 'zustand/vanilla'

import { type TruckListing } from '@/v2/entities/truck'
import {
  parseUrlInputText,
  prepareListingUrls,
  type PreparedListingSettledItem,
  type PreparedListingState,
} from '@/v2/features/listing-preparation'

import {
  type WorkflowPreviewItem,
  type WorkflowTracker,
} from './workflow-analytics'

interface RunPreviewWorkflowInput {
  getStartedAt?: () => number
  parse?: (url: string, signal?: AbortSignal) => Promise<TruckListing>
  signal?: AbortSignal
  store: StoreApi<PreparedListingState>
  text: string
  tracker: WorkflowTracker
}

interface RunPreviewWorkflowResult {
  duplicateMessage: string | null
}

const duplicateMessage = '이미 넣은 매물이에요.'

const toWorkflowPreviewItem = (
  item: PreparedListingSettledItem
): WorkflowPreviewItem => {
  if (item.status === 'ready') {
    return {
      id: item.id,
      url: item.url,
      status: 'ready',
    }
  }

  return {
    id: item.id,
    url: item.url,
    status: item.status,
    message: item.message,
  }
}

export async function runPreviewWorkflow({
  getStartedAt = () =>
    typeof performance !== 'undefined' ? performance.now() : Date.now(),
  parse,
  signal,
  store,
  text,
  tracker,
}: RunPreviewWorkflowInput): Promise<RunPreviewWorkflowResult> {
  const startedAt = getStartedAt()
  const input = parseUrlInputText(text)

  if (!input.success) {
    if (text.trim().length > 0) {
      tracker.unsupportedInputFailed({
        rawInput: text,
        startedAt,
      })
    }

    return { duplicateMessage: input.message }
  }

  if (signal?.aborted) {
    return { duplicateMessage: null }
  }

  const batch = tracker.previewStarted({
    urlCount: input.urls.length,
    startedAt,
  })

  const result = await prepareListingUrls({
    urls: input.urls,
    store,
    signal,
    parse,
  })

  if (signal?.aborted) {
    return { duplicateMessage: null }
  }

  tracker.previewCompleted({
    batch,
    items: result.settledItems.map(toWorkflowPreviewItem),
  })

  return {
    duplicateMessage: result.duplicates.length > 0 ? duplicateMessage : null,
  }
}
