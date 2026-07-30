import { PassThrough } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import {
  createStreamingResponse,
  readBoundedResponseBytes,
  readBoundedResponseText,
} from '../bounded-response'

function createChunkedResponse(chunks: string[], onCancel?: () => void) {
  const encoder = new TextEncoder()
  let nextChunkIndex = 0

  return new Response(
    new ReadableStream({
      pull(controller) {
        const chunk = chunks[nextChunkIndex]

        if (chunk === undefined) {
          controller.close()
          return
        }

        nextChunkIndex += 1
        controller.enqueue(encoder.encode(chunk))
      },
      cancel() {
        onCancel?.()
      },
    })
  )
}

describe('bounded response helpers', () => {
  it('rejects an oversized declared body before reading it', async () => {
    const response = new Response('small', {
      headers: {
        'content-length': '5',
      },
    })

    await expect(
      readBoundedResponseBytes(response, {
        maxBytes: 4,
      })
    ).rejects.toMatchObject({
      code: 'RESPONSE_BODY_TOO_LARGE',
      limitBytes: 4,
      observedBytes: 5,
    })
  })

  it('cancels a chunked body as soon as its streamed bytes cross the limit', async () => {
    const onCancel = vi.fn()
    const response = createChunkedResponse(['ab', 'cde'], onCancel)

    await expect(
      readBoundedResponseBytes(response, {
        maxBytes: 4,
      })
    ).rejects.toMatchObject({
      code: 'RESPONSE_BODY_TOO_LARGE',
      limitBytes: 4,
      observedBytes: 5,
    })

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('accepts a text body exactly at the byte limit', async () => {
    const response = createChunkedResponse(['ab', 'cd'])

    await expect(
      readBoundedResponseText(response, {
        maxBytes: 4,
      })
    ).resolves.toBe('abcd')
  })

  it('cancels a pending body when its read deadline expires', async () => {
    const onCancel = vi.fn()
    const response = new Response(
      new ReadableStream({
        pull() {
          return new Promise(() => {})
        },
        cancel() {
          onCancel()
        },
      })
    )

    await expect(
      readBoundedResponseBytes(response, {
        maxBytes: 4,
        timeoutMs: 10,
        createTimeoutError: () =>
          new DOMException('bounded response timed out', 'TimeoutError'),
      })
    ).rejects.toMatchObject({
      name: 'TimeoutError',
    })

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('returns response headers before the native source ends', async () => {
    const source = new PassThrough()
    const response = createStreamingResponse(source, {
      status: 200,
      headers: {
        'content-type': 'text/plain',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')

    const body = response.body
    if (!body) {
      throw new Error('Expected a streaming response body')
    }

    const reader = body.getReader()
    const firstChunkPromise = reader.read()

    source.write(Buffer.from('ok'))

    const firstChunk = await firstChunkPromise
    expect(firstChunk.done).toBe(false)
    expect(new TextDecoder().decode(firstChunk.value)).toBe('ok')

    source.end()
    await expect(reader.read()).resolves.toMatchObject({
      done: true,
    })
  })

  it('destroys the native source when the web response is canceled', async () => {
    const source = new PassThrough()
    const response = createStreamingResponse(source, {
      status: 200,
    })

    await response.body?.cancel()

    expect(source.destroyed).toBe(true)
  })
})
