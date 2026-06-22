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
    expect(await response.text()).toBe(
      '성능점검기록부 파일을 확인하지 못했어요.'
    )
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
      })
    )
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8')
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
    expect(await response.text()).toBe(
      '성능점검기록부 파일을 불러오지 못했어요.'
    )
  })

  it('returns 502 when the asset fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failure'))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
    expect(await response.text()).toBe(
      '성능점검기록부 파일을 불러오지 못했어요.'
    )
  })
})
