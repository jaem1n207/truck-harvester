import { describe, expect, it } from 'vitest'

import {
  CARMODOO_RENDER_MAX_PAGE_COUNT,
  decodeCarmodooNativeRenderResponse,
  isCarmodooPrintUrl,
} from '../carmodoo-performance-check'

const carmodooUrl =
  'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

describe('carmodoo-performance-check', () => {
  it('accepts Carmodoo print URLs with checkNum', () => {
    expect(isCarmodooPrintUrl(new URL(carmodooUrl))).toBe(true)
  })

  it('rejects Carmodoo URLs without checkNum', () => {
    expect(
      isCarmodooPrintUrl(
        new URL('https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0')
      )
    ).toBe(false)
  })

  it('rejects unsupported hosts and paths', () => {
    expect(
      isCarmodooPrintUrl(
        new URL(
          'https://example.com/carCheck/carmodooPrint.do?checkNum=7126000658'
        )
      )
    ).toBe(false)
    expect(
      isCarmodooPrintUrl(
        new URL('https://ck.carmodoo.com/other.do?checkNum=7126000658')
      )
    ).toBe(false)
  })

  it('decodes base64 JPG render responses to byte arrays', () => {
    const first = Buffer.from([1, 2, 3]).toString('base64')
    const second = Buffer.from([4, 5]).toString('base64')

    expect(
      decodeCarmodooNativeRenderResponse({
        images: [first, second],
      })
    ).toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])])
  })

  it('rejects malformed render responses', () => {
    expect(() => decodeCarmodooNativeRenderResponse({})).toThrow(
      '성능점검기록부 이미지를 만들지 못했습니다.'
    )
    expect(() =>
      decodeCarmodooNativeRenderResponse({
        images: Array.from({ length: CARMODOO_RENDER_MAX_PAGE_COUNT + 1 }, () =>
          Buffer.from([1]).toString('base64')
        ),
      })
    ).toThrow('성능점검기록부 이미지 수가 올바르지 않습니다.')
  })
})
