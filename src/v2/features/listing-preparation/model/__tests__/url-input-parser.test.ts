import { describe, expect, it } from 'vitest'

import {
  extractTruckUrlsFromText,
  parseUrlInputText,
} from '../url-input-parser'

const validUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

describe('listing preparation url input parser', () => {
  it('extracts supported truck listing addresses from pasted prose', () => {
    expect(
      extractTruckUrlsFromText(`확인 부탁드립니다\n${validUrl})\n감사합니다`)
    ).toEqual([validUrl])
  })

  it('deduplicates normalized listing addresses', () => {
    expect(extractTruckUrlsFromText(`${validUrl}\n${validUrl}.`)).toEqual([
      validUrl,
    ])
  })

  it('returns Korean empty-input guidance for whitespace', () => {
    expect(parseUrlInputText(' \n\t ')).toEqual({
      success: false,
      message: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    })
  })

  it('returns Korean invalid-input guidance when no supported address exists', () => {
    expect(parseUrlInputText('DetailView.asp?ShopNo=1')).toEqual({
      success: false,
      message: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    })
  })

  it('returns supported listing addresses for valid pasted input', () => {
    expect(parseUrlInputText(`메모\n${validUrl}`)).toEqual({
      success: true,
      urls: [validUrl],
    })
  })
})
