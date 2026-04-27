import pLimit from 'p-limit'

export type ConcurrentResult<TItem, TValue> =
  | {
      status: 'fulfilled'
      index: number
      item: TItem
      value: TValue
    }
  | {
      status: 'rejected'
      index: number
      item: TItem
      error: unknown
    }

interface RunConcurrentOptions<TItem, TValue> {
  items: readonly TItem[]
  limit: number
  task: (item: TItem, index: number) => Promise<TValue>
  signal?: AbortSignal
  onResult?: (result: ConcurrentResult<TItem, TValue>) => void
}

export async function runConcurrent<TItem, TValue>({
  items,
  limit,
  task,
  signal,
  onResult,
}: RunConcurrentOptions<TItem, TValue>) {
  const limiter = pLimit(limit)
  const abortError = () =>
    new DOMException('작업이 취소되었습니다.', 'AbortError')

  const jobs = items.map((item, index) =>
    limiter(async (): Promise<ConcurrentResult<TItem, TValue>> => {
      try {
        if (signal?.aborted) {
          throw abortError()
        }

        const value = await task(item, index)
        const result: ConcurrentResult<TItem, TValue> = {
          status: 'fulfilled',
          index,
          item,
          value,
        }
        onResult?.(result)
        return result
      } catch (error) {
        const result: ConcurrentResult<TItem, TValue> = {
          status: 'rejected',
          index,
          item,
          error,
        }
        onResult?.(result)
        return result
      }
    })
  )

  return Promise.all(jobs)
}
