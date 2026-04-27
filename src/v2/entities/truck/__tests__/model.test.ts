import { describe, expect, it } from 'vitest'

import {
  truckListingSchema,
  truckParseResultSchema,
  type TruckParseResult,
} from '../model'

const listing = {
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
  vname: '현대 마이티',
  vehicleName: '2020년 현대 마이티',
  vnumber: '12가3456',
  price: {
    raw: 3550,
    rawWon: 35500000,
    label: '3,550만원',
    compactLabel: '3.6천만',
  },
  year: '2020년',
  mileage: '150,000km',
  options: '에어컨/ABS',
  images: ['https://example.com/truck.jpg'],
}

describe('truckListingSchema', () => {
  it('parses the legacy truck shape used by v2', () => {
    expect(truckListingSchema.parse(listing)).toEqual(listing)
  })

  it('defaults missing images to an empty list', () => {
    const { images } = truckListingSchema.parse({
      ...listing,
      images: undefined,
    })

    expect(images).toEqual([])
  })
})

describe('truckParseResultSchema', () => {
  it('parses pending, success, and failed results', () => {
    const pending = truckParseResultSchema.parse({
      status: 'pending',
      id: 'truck-1',
      url: listing.url,
    })
    const success = truckParseResultSchema.parse({
      status: 'success',
      id: 'truck-1',
      url: listing.url,
      listing,
      parsedAt: '2026-04-26T00:00:00.000Z',
    })
    const failed = truckParseResultSchema.parse({
      status: 'failed',
      id: 'truck-1',
      url: listing.url,
      reason: 'site-timeout',
      message: '사이트 응답이 늦습니다. 다시 시도해볼까요?',
      failedAt: '2026-04-26T00:00:00.000Z',
    })

    expect(pending.status).toBe('pending')
    expect(success.status).toBe('success')
    expect(failed.status).toBe('failed')
  })

  it('narrows the discriminated union by status', () => {
    const result: TruckParseResult = truckParseResultSchema.parse({
      status: 'success',
      id: 'truck-1',
      url: listing.url,
      listing,
      parsedAt: '2026-04-26T00:00:00.000Z',
    })

    const label =
      result.status === 'success'
        ? result.listing.price.compactLabel
        : '아직 확인 중'

    expect(label).toBe('3.6천만')
  })
})
