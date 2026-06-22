import { afterEach, describe, expect, it, vi } from 'vitest'

import { CHECKPAPER_FETCH_TIMEOUT_MS } from '@/v2/shared/lib/checkpaper-proxy'

import { GET, maxDuration } from '../route'

const sourceUrl = 'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3'
const finalUrl =
  'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107099659&print=0&iframe=1&key='

const sampleHtml = `
  <html>
    <head>
      <link href="/assets/css/style_v2.css" rel="stylesheet">
      <script>console.log('should be removed')</script>
    </head>
    <body>
      <div id="print">print section</div>
      <a id="adobe-link" href="https://www.adobe.com/get.adobe.com">adobe link</a>
      <a href="javascript:alert(1)" onclick="alert(1)">event</a>
      <img id="car_img_file_url_1" src="/carimage/one.jpg" />
      <form action="/Service/CheckPaper"></form>
    </body>
  </html>
`

function createRequest(url: string) {
  return new Request(
    `http://localhost/api/v2/checkpaper?url=${encodeURIComponent(url)}`
  )
}

describe('GET /api/v2/checkpaper', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the route duration above the parse timeout', () => {
    expect(maxDuration).toBe(5)
  })

  it('uses a fetch timeout budget shorter than maxDuration', () => {
    expect(CHECKPAPER_FETCH_TIMEOUT_MS).toBeLessThan(maxDuration * 1000)
  })

  it('rejects missing or unsupported URLs', async () => {
    const missingUrlResponse = await GET(
      new Request('http://localhost/api/v2/checkpaper')
    )

    expect(missingUrlResponse.status).toBe(400)
    expect(missingUrlResponse.headers.get('cache-control')).toBe('no-store')
    expect(await missingUrlResponse.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })

    const unsupportedResponse = await GET(
      createRequest('https://example.com/checkpaper')
    )

    expect(unsupportedResponse.status).toBe(400)
    expect(await unsupportedResponse.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })
  })

  it('fetches and rewrites CheckPaper html', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            Location:
              'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107099659&print=0&iframe=1&key=',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(sampleHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))
    const body = await response.text()

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
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      finalUrl,
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

    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8'
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-security-policy')).toContain(
      "form-action 'none'"
    )
    expect(response.headers.get('content-security-policy')).toContain(
      "script-src 'none'"
    )
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'self' 'unsafe-inline'"
    )
    expect(body).toContain('/api/v2/checkpaper/asset?url=')
    expect(body).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css'
      )
    )
    expect(body).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/carimage/one.jpg'
      )
    )
    expect(body).toContain('action="/Service/CheckPaper"')
    expect(body).not.toContain('id="print"')
    expect(body).not.toContain('id="adobe-link"')
    expect(body).not.toContain('adobe link')
    expect(body).not.toContain('<script')
    expect(body).not.toContain('onclick')
  })

  it('returns 502 when CheckPaper fails to load', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 404,
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
  })

  it('rejects redirected hosts outside the checkpaper domain', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(sampleHtml, {
        status: 302,
        headers: { Location: 'https://example.com/Service/CheckPaper' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps timeout and aborts to fetch failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException('timeout', 'AbortError'))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
  })

  it('maps timeout during body read to fetch failure', async () => {
    vi.useFakeTimers()

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: vi.fn(() => new Promise(() => {})),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const responsePromise = GET(createRequest(sourceUrl))
    await vi.advanceTimersByTimeAsync(5000)
    const response = await responsePromise

    vi.useRealTimers()

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
  })
})
