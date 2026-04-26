import { describe, expect, it } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import {
  createPreparedListingStore,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
  selectSavedPreparedListings,
} from '../prepared-listing-store'

const firstUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
const secondUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4'

const listing: TruckListing = {
  url: firstUrl,
  vname: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
  vehicleName: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
  vnumber: '서울01가1234',
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

describe('prepared listing store', () => {
  it('adds new URLs as checking chips and reports duplicates', () => {
    const store = createPreparedListingStore()

    const firstResult = store.getState().addUrls([firstUrl, secondUrl])
    const duplicateResult = store
      .getState()
      .addUrls([firstUrl, secondUrl, secondUrl])

    expect(firstResult).toEqual({
      added: [firstUrl, secondUrl],
      duplicates: [],
    })
    expect(duplicateResult).toEqual({
      added: [],
      duplicates: [firstUrl, secondUrl, secondUrl],
    })
    expect(store.getState().items).toEqual([
      {
        status: 'checking',
        id: 'listing-1',
        url: firstUrl,
        label: '매물 이름 찾는 중',
      },
      {
        status: 'checking',
        id: 'listing-2',
        url: secondUrl,
        label: '매물 이름 찾는 중',
      },
    ])
  })

  it('marks checking item ready with a human-readable listing label', () => {
    const store = createPreparedListingStore()
    store.getState().addUrls([firstUrl])

    store.getState().markReady(firstUrl, listing)

    expect(store.getState().items[0]).toMatchObject({
      status: 'ready',
      id: 'listing-1',
      url: firstUrl,
      label: listing.vname,
      listing,
    })
    expect(selectReadyPreparedListings(store.getState())).toHaveLength(1)
  })

  it('keeps failed chips removable and explains recovery in Korean', () => {
    const store = createPreparedListingStore()
    store.getState().addUrls([firstUrl])

    store
      .getState()
      .markFailed(
        firstUrl,
        '사이트 응답이 늦어요. 주소를 확인한 뒤 다시 시도해 주세요.'
      )

    expect(store.getState().items[0]).toMatchObject({
      status: 'failed',
      label: '매물 이름을 확인하지 못했어요',
      message: '사이트 응답이 늦어요. 주소를 확인한 뒤 다시 시도해 주세요.',
    })

    store.getState().remove('listing-1')

    expect(store.getState().items).toEqual([])
  })

  it('tracks save progress and selects ready listings only', () => {
    const store = createPreparedListingStore()
    store.getState().addUrls([firstUrl, secondUrl])
    store.getState().markReady(firstUrl, listing)
    store
      .getState()
      .markInvalid(
        secondUrl,
        '지원하지 않는 주소예요. 매물 주소를 다시 확인해 주세요.'
      )

    store.getState().markSaving('listing-1', {
      downloadedImages: 1,
      totalImages: 3,
      progress: 40,
    })

    expect(store.getState().items[0]).toMatchObject({
      status: 'saving',
      downloadedImages: 1,
      totalImages: 3,
      progress: 40,
    })
    expect(selectReadyPreparedListings(store.getState())).toEqual([])
    expect(selectCheckingPreparedListings(store.getState())).toEqual([])

    store.getState().markSaved('listing-1')

    expect(selectSavedPreparedListings(store.getState())).toMatchObject([
      {
        status: 'saved',
        downloadedImages: 3,
        totalImages: 3,
        progress: 100,
      },
    ])
  })

  it('reset clears items and restarts predictable ids', () => {
    const store = createPreparedListingStore()
    store.getState().addUrls([firstUrl])

    store.getState().reset()
    store.getState().addUrls([secondUrl])

    expect(store.getState().items).toEqual([
      {
        status: 'checking',
        id: 'listing-1',
        url: secondUrl,
        label: '매물 이름 찾는 중',
      },
    ])
  })
})
