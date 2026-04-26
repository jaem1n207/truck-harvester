import { describe, expect, it } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'

import { parseUrlInputText } from '../url-input-schema'

const firstUrl =
  'http://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3#photo'
const duplicateUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
const secondUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4'

describe('url input schema', () => {
  it('normalizes each entered address and removes duplicates', () => {
    const result = parseUrlInputText(
      `${firstUrl}\n\n${duplicateUrl}\n${secondUrl}`
    )

    expect(result).toEqual({
      success: true,
      urls: [
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
        secondUrl,
      ],
    })
  })

  it('returns Korean recovery copy for empty input', () => {
    expect(parseUrlInputText('   ')).toEqual({
      success: false,
      message: v2Copy.urlInput.errors.empty,
    })
  })

  it('returns Korean recovery copy for unsupported addresses', () => {
    expect(parseUrlInputText('https://example.com/truck/1')).toEqual({
      success: false,
      message: v2Copy.urlInput.errors.invalid,
    })
  })
})
