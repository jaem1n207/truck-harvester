import { describe, expect, it } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'

import {
  extractTruckUrlsFromText,
  parseUrlInputText,
} from '../url-input-schema'

const firstUrl =
  'http://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3#photo'
const duplicateUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
const secondUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4'
const messyText = `
사장님 이 매물 확인 부탁드립니다.
https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3

다음 것도 같이요 https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4 감사합니다.
중복: http://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3#photo
`
const normalizedUrls = [
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
  secondUrl,
]
const requiredRecoveryMessage =
  '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.'

describe('url input schema', () => {
  it('extracts supported truck urls from pasted chat text and removes duplicates', () => {
    expect(extractTruckUrlsFromText(messyText)).toEqual(normalizedUrls)
  })

  it('returns an empty list when pasted text has no supported truck urls', () => {
    expect(
      extractTruckUrlsFromText(
        '이 문장에는 https://example.com/truck/1 만 있습니다.'
      )
    ).toEqual([])
  })

  it('extracts urls with trailing chat punctuation', () => {
    expect(
      extractTruckUrlsFromText(
        '확인: (https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3).'
      )
    ).toEqual([normalizedUrls[0]])
  })

  it('does not include adjacent Korean prose in query values', () => {
    expect(
      extractTruckUrlsFromText(
        '확인 https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3입니다'
      )
    ).toEqual([normalizedUrls[0]])
  })

  it('extracts urls when required query params are reordered', () => {
    expect(
      extractTruckUrlsFromText(
        'https://www.truck-no1.co.kr/model/DetailView.asp?MemberNo=2&ShopNo=1&OnCarNo=3'
      )
    ).toEqual([
      'https://www.truck-no1.co.kr/model/DetailView.asp?MemberNo=2&ShopNo=1&OnCarNo=3',
    ])
  })

  it('extracts urls with extra query params between required params', () => {
    expect(
      extractTruckUrlsFromText(
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&foo=bar&MemberNo=2&OnCarNo=3'
      )
    ).toEqual([
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&foo=bar&MemberNo=2&OnCarNo=3',
    ])
  })

  it('keeps parseUrlInputText compatible with extracted pasted text', () => {
    expect(parseUrlInputText(messyText)).toEqual({
      success: true,
      urls: normalizedUrls,
    })
  })

  it('normalizes each entered address and removes duplicates', () => {
    const result = parseUrlInputText(
      `${firstUrl}\n\n${duplicateUrl}\n${secondUrl}`
    )

    expect(result).toEqual({
      success: true,
      urls: normalizedUrls,
    })
  })

  it('returns Korean recovery copy for empty input', () => {
    expect(parseUrlInputText('   ')).toEqual({
      success: false,
      message: requiredRecoveryMessage,
    })
    expect(v2Copy.urlInput.errors.empty).toBe(requiredRecoveryMessage)
  })

  it('returns Korean recovery copy for unsupported addresses', () => {
    expect(parseUrlInputText('https://example.com/truck/1')).toEqual({
      success: false,
      message: requiredRecoveryMessage,
    })
    expect(v2Copy.urlInput.errors.invalid).toBe(requiredRecoveryMessage)
  })
})
