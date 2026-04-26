interface RetryOptions {
  retries?: number
  delaysMs?: readonly number[]
  wait?: (ms: number) => Promise<void>
}

const defaultDelaysMs = [300, 800] as const

function waitFor(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  { retries = 2, delaysMs = defaultDelaysMs, wait = waitFor }: RetryOptions = {}
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt < retries) {
        await wait(delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 0)
      }
    }
  }

  throw lastError
}
