import { describe, expect, it } from 'vitest'

import { normalizeTruckUrl, normalizedTruckUrlSchema } from '../model'

describe('normalizedTruckUrlSchema', () => {
  it('normalizes supported truck listing addresses', () => {
    expect(
      normalizeTruckUrl(
        'http://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3#top'
      )
    ).toBe(
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
    )
  })

  it('rejects unsupported domains with plain Korean copy', () => {
    const result = normalizedTruckUrlSchema.safeParse(
      'https://example.com/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      '지원하는 매물 사이트 주소만 사용할 수 있습니다.'
    )
  })

  it('rejects listing addresses missing required detail values', () => {
    const result = normalizedTruckUrlSchema.safeParse(
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1'
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      '매물 주소에 필요한 정보가 빠져 있습니다.'
    )
  })
})
