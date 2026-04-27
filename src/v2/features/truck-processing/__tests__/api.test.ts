import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseTruckListing } from '../api'

const url =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

const listing = {
  url,
  vname: '현대 마이티',
  vehicleName: '2020년 현대 마이티',
  vnumber: '12가3456',
  price: {
    raw: 3550,
    rawWon: 35500000,
    label: '3,550만원',
    compactLabel: '3.6천만',
  },
  year: '2020',
  mileage: '150,000km',
  options: '냉동탑 / 후방카메라',
  images: ['https://img.example.com/one.jpg'],
}

describe('parseTruckListing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts one listing address to the v2 parse endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: listing,
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(parseTruckListing({ url })).resolves.toEqual(listing)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v2/parse-truck',
      expect.objectContaining({
        method: 'POST',
        signal: undefined,
        body: JSON.stringify({ url, timeoutMs: 3500 }),
      })
    )
  })

  it('throws the recovery message returned by the v2 parse endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            success: false,
            reason: 'site-timeout',
            message: '사이트 응답이 늦습니다. 다시 시도해볼까요?',
          },
          { status: 504 }
        )
      )
    )

    await expect(parseTruckListing({ url })).rejects.toThrow(
      '사이트 응답이 늦습니다. 다시 시도해볼까요?'
    )
  })
})
