import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../route'

const sourceUrl = 'https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css'

function createRequest(url: string) {
  return new Request(
    `http://localhost/api/v2/checkpaper/asset?url=${encodeURIComponent(url)}`
  )
}

describe('GET /api/v2/checkpaper/asset', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects unsupported asset URLs', async () => {
    const response = await GET(createRequest('https://example.com/file.png'))

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 확인하지 못했어요.',
    })
  })

  it('rejects unsupported non-web asset URLs', async () => {
    const response = await GET(
      createRequest('ftp://checkpaper.jmenetworks.co.kr/file.png')
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 확인하지 못했어요.',
    })
  })

  it('rejects HTML responses as active-document assets', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<html><script>alert(1)</script></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toEqual({
      success: false,
      message: '성능점검기록부 파일을 불러오지 못했어요.',
    })
  })

  it('forwards allowed CheckPaper assets as bytes with content-type', async () => {
    const body = 'asset-bytes'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))
    const returnedBody = await response.text()

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      sourceUrl,
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'manual',
        headers: expect.objectContaining({
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'User-Agent': expect.any(String),
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        }),
      })
    )
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(returnedBody).toBe(body)
  })

  it('rewrites relative css references when serving css assets', async () => {
    const css = `
      .hero { background: url('/images/hero.png'); }
      @import url("./print.css");
      .inline { background: url(data:image/png;base64,abc); }
    `
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(css, {
        status: 200,
        headers: { 'content-type': 'text/css; charset=utf-8' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))
    const rewritten = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(rewritten).toContain(
      encodeURIComponent('https://checkpaper.jmenetworks.co.kr/images/hero.png')
    )
    expect(rewritten).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/assets/css/print.css'
      )
    )
    expect(rewritten).toContain('data:image/png;base64,abc')
  })

  it('handles redirect to allowed host and rewrites using the final URL', async () => {
    const finalUrl = 'https://checkpaper.jmenetworks.co.kr/theme/style.css?v=2'

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: '/theme/style.css?v=2' },
        })
      )
      .mockResolvedValueOnce(
        new Response('a{background:url("../img.png")}', {
          status: 200,
          headers: { 'content-type': 'text/css' },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))
    const rewritten = await response.text()

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      finalUrl,
      expect.objectContaining({ redirect: 'manual' })
    )
    expect(rewritten).toContain(
      encodeURIComponent('https://checkpaper.jmenetworks.co.kr/img.png')
    )
    expect(response.headers.get('content-type')).toBe('text/css')
  })

  it('rejects redirected hosts outside the checkpaper domain', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'https://example.com/assets/file.css' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 확인하지 못했어요.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns 502 when the asset request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 500,
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 불러오지 못했어요.',
    })
  })

  it('returns 502 when the asset fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failure'))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 불러오지 못했어요.',
    })
  })

  it('maps timeout/aborts to fetch failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException('timeout', 'AbortError'))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 불러오지 못했어요.',
    })
  })

  it('maps timeout during body read to fetch failure', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/plain' }),
      arrayBuffer: vi.fn(() => new Promise(() => {})),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const responsePromise = GET(createRequest(sourceUrl))
    await vi.advanceTimersByTimeAsync(5000)
    const response = await responsePromise

    vi.useRealTimers()

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 불러오지 못했어요.',
    })
  })
})
