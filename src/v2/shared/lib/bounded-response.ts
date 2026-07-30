import type { IncomingHttpHeaders } from 'node:http'
import type { Readable } from 'node:stream'

type BoundedResponseOptions = {
  maxBytes: number
  timeoutMs?: number
  createTimeoutError?: () => Error
}

export class ResponseBodyTooLargeError extends Error {
  readonly code: 'RESPONSE_BODY_TOO_LARGE' = 'RESPONSE_BODY_TOO_LARGE'

  constructor(
    readonly observedBytes: number,
    readonly limitBytes: number
  ) {
    super(
      `Response body exceeded ${limitBytes} bytes (observed ${observedBytes})`
    )
    this.name = 'ResponseBodyTooLargeError'
  }
}

function parseDeclaredContentLength(response: Response) {
  const value = response.headers.get('content-length')

  if (value === null || !/^\d+$/.test(value)) {
    return undefined
  }

  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed)) {
    return undefined
  }

  return parsed
}

function mergeChunks(
  chunks: Uint8Array[],
  totalLength: number
): Uint8Array<ArrayBuffer> {
  const merged = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return merged
}

function defaultTimeoutError() {
  return new DOMException('Response body read timed out', 'TimeoutError')
}

export async function cancelResponseBody(response: Response) {
  try {
    await response.body?.cancel()
  } catch {
    // Cancellation is best-effort cleanup and must not mask the route error.
  }
}

export async function readBoundedResponseBytes(
  response: Response,
  {
    maxBytes,
    timeoutMs,
    createTimeoutError = defaultTimeoutError,
  }: BoundedResponseOptions
): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBytes must be a non-negative safe integer')
  }

  const declaredLength = parseDeclaredContentLength(response)
  if (declaredLength !== undefined && declaredLength > maxBytes) {
    await cancelResponseBody(response)
    throw new ResponseBodyTooLargeError(declaredLength, maxBytes)
  }

  if (!response.body) {
    return new Uint8Array()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timeoutError: Error | undefined

  const timeout =
    timeoutMs === undefined
      ? undefined
      : new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => {
              timeoutError = createTimeoutError()
              reject(timeoutError)
              void reader.cancel().catch(() => undefined)
            },
            Math.max(0, timeoutMs)
          )
        })

  try {
    while (true) {
      const result = timeout
        ? await Promise.race([reader.read(), timeout])
        : await reader.read()

      if (timeoutError) {
        throw timeoutError
      }

      if (result.done) {
        return mergeChunks(chunks, totalLength)
      }

      totalLength += result.value.byteLength

      if (totalLength > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new ResponseBodyTooLargeError(totalLength, maxBytes)
      }

      chunks.push(result.value)
    }
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

export async function readBoundedResponseText(
  response: Response,
  options: BoundedResponseOptions
) {
  const body = await readBoundedResponseBytes(response, options)

  return new TextDecoder().decode(body)
}

export function toResponseHeaders(headers: IncomingHttpHeaders) {
  const responseHeaders = new Headers()

  Object.entries(headers).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => responseHeaders.append(name, item))
      return
    }

    if (value !== undefined) {
      responseHeaders.set(name, value)
    }
  })

  return responseHeaders
}

export function createStreamingResponse(source: Readable, init: ResponseInit) {
  let cleanup = () => {}
  let settled = false

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const finish = (action: () => void) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        action()
      }

      const onData = (chunk: unknown) => {
        source.pause()

        try {
          if (typeof chunk === 'string') {
            controller.enqueue(new TextEncoder().encode(chunk))
            return
          }

          if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
            controller.enqueue(Uint8Array.from(chunk))
            return
          }

          throw new TypeError('Unsupported native response body chunk')
        } catch (error) {
          finish(() => controller.error(error))
          source.destroy(error instanceof Error ? error : undefined)
        }
      }

      const onEnd = () => {
        finish(() => controller.close())
      }
      const onError = (error: Error) => {
        finish(() => controller.error(error))
      }
      const onAborted = () => {
        onError(new Error('Native response aborted'))
      }

      cleanup = () => {
        source.off('data', onData)
        source.off('end', onEnd)
        source.off('error', onError)
        source.off('aborted', onAborted)
      }

      source.on('data', onData)
      source.once('end', onEnd)
      source.once('error', onError)
      source.once('aborted', onAborted)
      source.pause()
    },
    pull() {
      if (!settled) {
        source.resume()
      }
    },
    cancel(reason) {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      source.destroy(reason instanceof Error ? reason : undefined)
    },
  })

  return new Response(body, init)
}
