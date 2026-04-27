import { describe, expect, it } from 'vitest'

import { type TruckListing, type TruckParseResult } from '@/v2/entities/truck'

import { processTruckBatch } from '../batch'

const urls = Array.from(
  { length: 6 },
  (_, index) =>
    `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=${index + 1}`
)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createListing(url: string): TruckListing {
  return {
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
}

describe('processTruckBatch', () => {
  it('uses five concurrent parse jobs by default', async () => {
    let active = 0
    let maxActive = 0

    const results = await processTruckBatch({
      urls,
      parse: async (url) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await delay(5)
        active -= 1
        return createListing(url)
      },
      retryWait: async () => undefined,
    })

    expect(maxActive).toBe(5)
    expect(results).toHaveLength(6)
    expect(results.every((result) => result.status === 'success')).toBe(true)
  })

  it('reports each result as it arrives and keeps going after failures', async () => {
    const arrived: TruckParseResult[] = []

    const results = await processTruckBatch({
      urls: urls.slice(0, 3),
      parse: async (url) => {
        if (url.endsWith('2')) {
          throw new Error('사이트 응답이 늦습니다. 다시 시도해볼까요?')
        }

        return createListing(url)
      },
      retryWait: async () => undefined,
      onResult: (result) => arrived.push(result),
    })

    expect(arrived).toHaveLength(3)
    expect(results.map((result) => result.status)).toEqual([
      'success',
      'failed',
      'success',
    ])
    expect(results[1]).toMatchObject({
      status: 'failed',
      reason: 'unknown',
      message: '사이트 응답이 늦습니다. 다시 시도해볼까요?',
    })
  })

  it('retries temporary parse failures before returning success', async () => {
    let attempts = 0

    const results = await processTruckBatch({
      urls: [urls[0]],
      parse: async (url) => {
        attempts += 1
        if (attempts < 3) {
          throw new Error('temporary')
        }

        return createListing(url)
      },
      retryWait: async () => undefined,
    })

    expect(attempts).toBe(3)
    expect(results[0]).toMatchObject({
      status: 'success',
      listing: createListing(urls[0]),
    })
  })
})
