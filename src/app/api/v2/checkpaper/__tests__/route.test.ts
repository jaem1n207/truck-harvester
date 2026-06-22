import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET, maxDuration } from '../route'

const sourceUrl = 'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3'
const finalUrl =
  'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107099659&print=0&iframe=1&key='

const sampleHtml = `
  <html>
    <head>
      <link href="/assets/css/style_v2.css" rel="stylesheet">
      <script src="/assets/vendor/jquery/jquery.min.js"></script>
    </head>
    <body>
      <div id="print">print section</div>
      <a href="https://www.adobe.com/get.adobe.com">adobe link</a>
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

  it('rejects missing or unsupported URLs', async () => {
    const missingUrlResponse = await GET(
      new Request('http://localhost/api/v2/checkpaper')
    )

    expect(missingUrlResponse.status).toBe(400)
    expect(await missingUrlResponse.text()).toBe(
      '성능점검기록부 주소를 확인하지 못했어요.'
    )

    const unsupportedResponse = await GET(
      createRequest('https://example.com/checkpaper')
    )

    expect(unsupportedResponse.status).toBe(400)
    expect(await unsupportedResponse.text()).toBe(
      '성능점검기록부 주소를 확인하지 못했어요.'
    )
  })

  it('fetches and rewrites CheckPaper html', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: finalUrl,
      text: vi.fn().mockResolvedValue(sampleHtml),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      sourceUrl,
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'follow',
      })
    )

    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8'
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toContain('/api/v2/checkpaper/asset?url=')
    expect(body).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css'
      )
    )
    expect(body).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/assets/vendor/jquery/jquery.min.js'
      )
    )
    expect(body).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/carimage/one.jpg'
      )
    )
    expect(body).toContain('action="/Service/CheckPaper"')
    expect(body).not.toContain('id="print"')
    expect(body).not.toContain('get.adobe.com')
  })

  it('returns 502 when CheckPaper fails to load', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn(),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('성능점검기록부를 불러오지 못했어요.')
  })

  it('rejects redirected hosts outside the checkpaper domain', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/Service/CheckPaper',
      text: vi.fn().mockResolvedValue(sampleHtml),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(sourceUrl))

    expect(response.status).toBe(400)
    expect(await response.text()).toBe(
      '성능점검기록부 주소를 확인하지 못했어요.'
    )
  })
})
