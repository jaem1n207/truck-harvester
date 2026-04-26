import { describe, expect, it } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { createTruckBatchStore } from '../truck-batch-store'

const urls = [
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=1',
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=2',
]

const listing: TruckListing = {
  url: urls[0],
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

describe('truck batch store', () => {
  it('adds URLs as pending items with stable ids', () => {
    const store = createTruckBatchStore()

    store.getState().addUrls(urls)

    expect(store.getState().items).toEqual([
      { status: 'pending', id: 'truck-1', url: urls[0] },
      { status: 'pending', id: 'truck-2', url: urls[1] },
    ])
  })

  it('transitions an item through parsing, parsed, downloading, and downloaded', () => {
    const store = createTruckBatchStore()
    store.getState().addUrls([urls[0]])

    store.getState().setParsing('truck-1')
    expect(store.getState().items[0]).toMatchObject({
      status: 'parsing',
      id: 'truck-1',
      url: urls[0],
    })

    store.getState().setParsed('truck-1', listing)
    expect(store.getState().items[0]).toMatchObject({
      status: 'parsed',
      listing,
    })

    store.getState().setDownloading('truck-1', {
      downloadedImages: 0,
      totalImages: 1,
      progress: 0,
    })
    expect(store.getState().items[0]).toMatchObject({
      status: 'downloading',
      progress: 0,
    })

    store.getState().setDownloaded('truck-1')
    expect(store.getState().items[0]).toMatchObject({
      status: 'downloaded',
      downloadedImages: 1,
      totalImages: 1,
    })
  })

  it('throws when transitioning an unknown item', () => {
    const store = createTruckBatchStore()

    expect(() => store.getState().setParsing('missing')).toThrow(
      '작업 항목을 찾을 수 없습니다.'
    )
  })

  it('retries a failed item by returning it to pending', () => {
    const store = createTruckBatchStore()
    store.getState().addUrls([urls[0]])
    store.getState().setFailed('truck-1', {
      reason: 'site-timeout',
      message: '사이트 응답이 늦습니다. 다시 시도해볼까요?',
    })

    store.getState().retry('truck-1')

    expect(store.getState().items[0]).toEqual({
      status: 'pending',
      id: 'truck-1',
      url: urls[0],
    })
  })
})
