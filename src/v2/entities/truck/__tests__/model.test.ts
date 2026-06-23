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
  performanceCheckUrl:
    'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
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

const smartStoreTable = {
  vehicleName: '포터2 1.3톤활어운반차',
  registrationLabel: '2023년 11월 등록',
  mileage: '159,600km',
  vehicleNumber: '822수2698',
  upperInfo: '인증차(바로1.3톤활어운반차), 액산병 보유',
  lowerInfo: '1인신조, 무사고, 오토미션',
  hasVehicleInfo: true,
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

  it('allows listings without a performance check URL', () => {
    const parsed = truckListingSchema.parse({
      ...listing,
      performanceCheckUrl: undefined,
    })

    expect(parsed.performanceCheckUrl).toBeUndefined()
  })

  it('parses smart store table details when present', () => {
    const parsed = truckListingSchema.parse({
      ...listing,
      smartStoreTable,
    })

    expect(parsed.smartStoreTable).toEqual(smartStoreTable)
  })

  it('allows existing listing payloads without smart store table details', () => {
    const parsed = truckListingSchema.parse(listing)

    expect(parsed.smartStoreTable).toBeUndefined()
  })

  it('rejects non-web performance check URLs', () => {
    expect(
      truckListingSchema.safeParse({
        ...listing,
        performanceCheckUrl: 'javascript:alert(1)',
      }).success
    ).toBe(false)
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
