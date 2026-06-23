import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPostHandler, maxDuration } from '../route'

const carmodooUrl =
  'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

function createRequest(body: unknown) {
  return new Request('http://localhost/api/v2/checkpaper/carmodoo-render', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

describe('POST /api/v2/checkpaper/carmodoo-render', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a render budget long enough for Chromium startup', () => {
    expect(maxDuration).toBeGreaterThanOrEqual(15)
  })

  it('renders Carmodoo URLs and returns base64 JPG images', async () => {
    const render = vi.fn(async () => [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5]),
    ])
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url: carmodooUrl }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      images: [
        Buffer.from([1, 2, 3]).toString('base64'),
        Buffer.from([4, 5]).toString('base64'),
      ],
    })
    expect(render).toHaveBeenCalledWith(carmodooUrl, {
      origin: 'http://localhost',
    })
  })

  it('rejects missing and unsupported URLs before calling renderer', async () => {
    const render = vi.fn()
    const POST = createPostHandler({ render })

    const missingResponse = await POST(createRequest({}))
    const unsupportedResponse = await POST(
      createRequest({ url: 'https://example.com/report' })
    )

    expect(missingResponse.status).toBe(400)
    expect(await missingResponse.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })
    expect(unsupportedResponse.status).toBe(400)
    expect(render).not.toHaveBeenCalled()
  })

  it('returns a quiet Korean error when rendering fails', async () => {
    const render = vi.fn(async () => {
      throw new Error('browser failed')
    })
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url: carmodooUrl }))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
  })
})
