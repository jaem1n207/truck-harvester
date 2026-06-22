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

  it('forwards allowed CheckPaper assets as bytes with content-type', async () => {
    const body = 'asset-bytes'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/css; charset=utf-8' },
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
        redirect: 'follow',
        headers: expect.objectContaining({
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'User-Agent': expect.any(String),
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        }),
      })
    )
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(returnedBody).toBe(body)
  })

  it('returns 502 when the asset request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
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

  it('rejects redirected hosts outside the checkpaper domain', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/assets/file.css',
      arrayBuffer: vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode('asset').buffer),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 파일을 확인하지 못했어요.',
    })
  })
})
