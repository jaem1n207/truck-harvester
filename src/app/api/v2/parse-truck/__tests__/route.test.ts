import { afterEach, describe, expect, it, vi } from 'vitest'

import { POST } from '../route'

const validUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

const listingHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">현대 마이티</p>
    <p class="vnumber">12가3456</p>
    <p class="vcash"><span class="red">3,550</span></p>
    <div class="car-detail">
      <dl>
        <dd><strong class="number">2020</strong></dd>
        <dd><strong class="red number">150,000</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      <p><font><span><b><span>차명: 2020년 현대 마이티</span></b></span></font></p>
      ▶ 추가장착 옵션 :: 냉동탑, 후방카메라<br />
    </div>
    <div class="sumnail">
      <ul>
        <li><img onmouseover="changeImg('https://img.example.com/one.jpg')" src="https://img.example.com/one_TH.jpg" /></li>
      </ul>
    </div>
  </body>
</html>
`

function createRequest(body: unknown) {
  return new Request('http://localhost/api/v2/parse-truck', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  })
}

describe('POST /api/v2/parse-truck', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and parses one truck listing address', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(listingHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createRequest({ url: validUrl }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      validUrl,
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    )
    expect(body).toEqual({
      success: true,
      data: expect.objectContaining({
        url: validUrl,
        vname: '현대 마이티',
        vehicleName: '2020년 현대 마이티',
        vnumber: '12가3456',
        images: ['https://img.example.com/one.jpg'],
      }),
    })
  })

  it('rejects unsupported addresses with Korean recovery copy', async () => {
    const response = await POST(
      createRequest({
        url: 'https://example.com/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      success: false,
      reason: 'invalid-address',
      message: '지원하는 매물 사이트 주소만 사용할 수 있습니다.',
    })
  })
})
