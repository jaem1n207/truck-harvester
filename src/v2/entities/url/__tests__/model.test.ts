import { describe, expect, it } from 'vitest'

import { normalizeTruckUrl, normalizedTruckUrlSchema } from '../model'

const encryptedUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=170F7EB3CD83769C6699017BF2BA45'

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

  it.each([
    encryptedUrl,
    'https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=A',
    'https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=A._~%2F',
    'https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=A.',
  ])('normalizes opaque encrypted truck listing addresses: %s', (url) => {
    expect(normalizeTruckUrl(url)).toBe(url)
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

  it.each([
    'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1',
    'https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=',
  ])('rejects listing addresses missing required detail values: %s', (url) => {
    const result = normalizedTruckUrlSchema.safeParse(url)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      '매물 주소에 필요한 정보가 빠져 있습니다.'
    )
  })

  it('rejects legacy listing addresses with empty identity values', () => {
    const result = normalizedTruckUrlSchema.safeParse(
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=&MemberNo=2&OnCarNo=3'
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      '매물 주소에 필요한 정보가 빠져 있습니다.'
    )
  })

  it.each([
    'https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=A&encOnCarNo=',
    'https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=&encOnCarNo=A',
    'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&ShopNo=2&MemberNo=3&OnCarNo=4',
  ])('rejects duplicate listing identity keys: %s', (url) => {
    const result = normalizedTruckUrlSchema.safeParse(url)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      '매물 주소에 필요한 정보가 빠져 있습니다.'
    )
  })
})
