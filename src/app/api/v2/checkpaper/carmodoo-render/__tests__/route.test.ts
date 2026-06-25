import { afterEach, describe, expect, it, vi } from 'vitest'

import { CARMODOO_RENDER_MAX_PAGE_COUNT } from '@/v2/shared/lib/carmodoo-performance-check'

import { createPostHandler, maxDuration } from '../route'

const carmodooUrl =
  'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

function createRequestFromText(body: string) {
  return new Request('http://localhost/api/v2/checkpaper/carmodoo-render', {
    body,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

function createRequest(body: unknown) {
  return createRequestFromText(JSON.stringify(body))
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

  it('rejects malformed JSON before calling renderer', async () => {
    const render = vi.fn()
    const POST = createPostHandler({ render })

    const response = await POST(createRequestFromText('{'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })
    expect(render).not.toHaveBeenCalled()
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

  it.each([
    'ftp://ck.carmodoo.com/carCheck/carmodooPrint.do?checkNum=7126000658',
    'http://ck.carmodoo.com/carCheck/carmodooPrint.do?checkNum=7126000658',
  ])('rejects non-HTTPS Carmodoo URLs before calling renderer', async (url) => {
    const render = vi.fn()
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })
    expect(render).not.toHaveBeenCalled()
  })

  it('rejects Carmodoo URLs without checkNum before calling renderer', async () => {
    const render = vi.fn()
    const POST = createPostHandler({ render })

    const response = await POST(
      createRequest({
        url: 'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0',
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })
    expect(render).not.toHaveBeenCalled()
  })

  it('rejects empty renderer output', async () => {
    const render = vi.fn(async () => [])
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url: carmodooUrl }))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
  })

  it('rejects renderer output with too many pages', async () => {
    const render = vi.fn(async () =>
      Array.from(
        { length: CARMODOO_RENDER_MAX_PAGE_COUNT + 1 },
        () => new Uint8Array([1])
      )
    )
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url: carmodooUrl }))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
  })

  it('rejects zero-byte rendered images', async () => {
    const render = vi.fn(async () => [new Uint8Array()])
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url: carmodooUrl }))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
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
