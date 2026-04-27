import { type TruckListing, type TruckParseResult } from '@/v2/entities/truck'
import { runConcurrent } from '@/v2/shared/lib/concurrency'
import { retryOperation } from '@/v2/shared/lib/retry'

import { parseTruckListing } from './api'

const defaultConcurrency = 5

interface ProcessTruckBatchInput {
  urls: readonly string[]
  concurrency?: number
  signal?: AbortSignal
  parse?: (url: string, signal?: AbortSignal) => Promise<TruckListing>
  retryWait?: (ms: number) => Promise<void>
  onResult?: (result: TruckParseResult) => void
}

function createId(index: number) {
  return `truck-${index + 1}`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '매물 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

function createFailedResult(
  url: string,
  index: number,
  error: unknown
): TruckParseResult {
  return {
    status: 'failed',
    id: createId(index),
    url,
    reason: 'unknown',
    message: getErrorMessage(error),
    failedAt: new Date().toISOString(),
  }
}

export async function processTruckBatch({
  urls,
  concurrency = defaultConcurrency,
  signal,
  parse = (url, requestSignal) =>
    parseTruckListing({ url, signal: requestSignal }),
  retryWait,
  onResult,
}: ProcessTruckBatchInput): Promise<TruckParseResult[]> {
  const settled = await runConcurrent({
    items: urls,
    limit: concurrency,
    signal,
    task: async (url, index) => {
      try {
        const listing = await retryOperation(() => parse(url, signal), {
          retries: 2,
          wait: retryWait,
        })
        const result: TruckParseResult = {
          status: 'success',
          id: createId(index),
          url,
          listing,
          parsedAt: new Date().toISOString(),
        }
        onResult?.(result)
        return result
      } catch (error) {
        const result = createFailedResult(url, index, error)
        onResult?.(result)
        return result
      }
    },
  })

  return settled.map((result) =>
    result.status === 'fulfilled'
      ? result.value
      : createFailedResult(result.item, result.index, result.error)
  )
}
