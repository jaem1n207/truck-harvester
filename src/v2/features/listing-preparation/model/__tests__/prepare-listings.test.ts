import { describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { prepareListingUrls } from '../prepare-listings'
import {
  createPreparedListingStore,
  selectReadyPreparedListings,
} from '../prepared-listing-store'

const recoveryMessage =
  '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.'

const buildUrl = (id: number) =>
  `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=${id}`

const createListing = (url: string, id: number): TruckListing => ({
  url,
  vname: `[활어차]포터2 ${id}`,
  vehicleName: `[활어차]포터2 ${id}`,
  vnumber: `서울${String(id).padStart(2, '0')}가1234`,
  price: {
    raw: 3550,
    rawWon: 35500000,
    label: '3,550만원',
    compactLabel: '3.6천만',
  },
  year: '2020',
  mileage: '150,000km',
  options: '냉동탑 / 후방카메라',
  images: [],
})

const createAddedItems = (urls: readonly string[], startId = 1) =>
  urls.map((url, index) => ({ id: `listing-${startId + index}`, url }))

const waitUntil = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error('조건이 시간 안에 충족되지 않았어요.')
}

describe('prepareListingUrls', () => {
  it('adds URLs and marks successful previews ready', async () => {
    const store = createPreparedListingStore()
    const urls = [buildUrl(1), buildUrl(2)]
    const parse = vi.fn(async (url: string) =>
      createListing(url, Number(new URL(url).searchParams.get('OnCarNo')))
    )

    const result = await prepareListingUrls({ urls, store, parse })

    expect(result).toEqual({
      added: urls,
      duplicates: [],
      addedItems: createAddedItems(urls),
    })
    expect(parse).toHaveBeenCalledTimes(2)
    expect(store.getState().items).toMatchObject([
      {
        status: 'ready',
        url: urls[0],
        label: '[활어차]포터2 1',
      },
      {
        status: 'ready',
        url: urls[1],
        label: '[활어차]포터2 2',
      },
    ])
  })

  it('does not preview duplicate URLs again', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(3)
    const parse = vi.fn(async (inputUrl: string) => createListing(inputUrl, 3))

    await prepareListingUrls({ urls: [url], store, parse })
    const result = await prepareListingUrls({ urls: [url], store, parse })

    expect(result).toEqual({ added: [], duplicates: [url], addedItems: [] })
    expect(parse).toHaveBeenCalledTimes(1)
    expect(store.getState().items).toHaveLength(1)
  })

  it('marks failed previews with Korean recovery copy', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(4)
    const parse = vi.fn(async () => {
      throw new Error('network failed')
    })

    const result = await prepareListingUrls({ urls: [url], store, parse })

    expect(result).toEqual({
      added: [url],
      duplicates: [],
      addedItems: createAddedItems([url]),
    })
    expect(store.getState().items[0]).toMatchObject({
      status: 'failed',
      url,
      label: '매물 이름을 확인하지 못했어요',
      message: recoveryMessage,
    })
  })

  it('does not mark a page with missing listing identity ready', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(24)
    const parse = vi.fn(async () => ({
      ...createListing(url, 24),
      vname: '차명 정보 없음',
      vehicleName: '차명 정보 없음',
    }))

    const result = await prepareListingUrls({ urls: [url], store, parse })

    expect(result).toEqual({
      added: [url],
      duplicates: [],
      addedItems: createAddedItems([url]),
    })
    expect(store.getState().items[0]).toMatchObject({
      status: 'invalid',
      url,
      label: '주소 확인 필요',
      message: '매물 정보를 찾지 못했어요. 주소를 다시 확인해 주세요.',
    })
    expect(selectReadyPreparedListings(store.getState())).toEqual([])
  })

  it('cleans up newly added checking items when the signal is already aborted', async () => {
    const store = createPreparedListingStore()
    const urls = [buildUrl(5), buildUrl(6)]
    const controller = new AbortController()
    const parse = vi.fn(async (url: string) => createListing(url, 5))

    controller.abort()

    const result = await prepareListingUrls({
      urls,
      store,
      signal: controller.signal,
      parse,
    })

    expect(result).toEqual({
      added: urls,
      duplicates: [],
      addedItems: createAddedItems(urls),
    })
    expect(parse).not.toHaveBeenCalled()
    expect(store.getState().items).toEqual([])
  })

  it('keeps ready previews and cleans up checking items when abort happens during parse', async () => {
    const store = createPreparedListingStore()
    const readyUrl = buildUrl(7)
    const abortedUrl = buildUrl(8)
    const controller = new AbortController()
    const parse = vi.fn((url: string, signal?: AbortSignal) => {
      if (url === readyUrl) {
        return Promise.resolve(createListing(url, 7))
      }

      return new Promise<TruckListing>((_, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('작업이 취소되었습니다.', 'AbortError'))
        })
      })
    })

    const preparePromise = prepareListingUrls({
      urls: [readyUrl, abortedUrl],
      store,
      concurrency: 2,
      signal: controller.signal,
      parse,
    })

    await waitUntil(() => parse.mock.calls.length === 2)
    await waitUntil(() => store.getState().items[0]?.status === 'ready')

    controller.abort()
    await preparePromise

    expect(store.getState().items).toMatchObject([
      {
        status: 'ready',
        url: readyUrl,
        label: '[활어차]포터2 7',
      },
    ])
    expect(
      store
        .getState()
        .items.some(
          (item) =>
            item.url === abortedUrl &&
            item.status === 'failed' &&
            item.message === recoveryMessage
        )
    ).toBe(false)
  })

  it('limits automatic previews to five concurrent requests by default', async () => {
    const store = createPreparedListingStore()
    const urls = Array.from({ length: 6 }, (_, index) => buildUrl(index + 10))
    const releases: Array<() => void> = []
    let active = 0
    let maxActive = 0
    const parse = vi.fn(
      (url: string) =>
        new Promise<TruckListing>((resolve) => {
          active += 1
          maxActive = Math.max(maxActive, active)
          releases.push(() => {
            active -= 1
            resolve(
              createListing(
                url,
                Number(new URL(url).searchParams.get('OnCarNo'))
              )
            )
          })
        })
    )

    const preparePromise = prepareListingUrls({ urls, store, parse })

    await waitUntil(() => parse.mock.calls.length === 5)

    expect(maxActive).toBe(5)
    expect(parse).toHaveBeenCalledTimes(5)

    releases.shift()?.()
    await waitUntil(() => parse.mock.calls.length === 6)

    expect(maxActive).toBe(5)

    releases.splice(0).forEach((release) => release())
    await preparePromise

    expect(
      store.getState().items.every((item) => item.status === 'ready')
    ).toBe(true)
  })

  it('does not remove a newer checking item for the same URL when an old run aborts', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(20)
    const controller = new AbortController()
    const parse = vi.fn(
      (_url: string, signal?: AbortSignal) =>
        new Promise<TruckListing>((_, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('작업이 취소되었습니다.', 'AbortError'))
          })
        })
    )

    const preparePromise = prepareListingUrls({
      urls: [url],
      store,
      signal: controller.signal,
      parse,
    })

    await waitUntil(() => parse.mock.calls.length === 1)

    const originalItem = store.getState().items[0]
    expect(originalItem).toMatchObject({ status: 'checking', url })

    store.getState().remove(originalItem.id)
    expect(store.getState().addUrls([url])).toEqual({
      added: [url],
      duplicates: [],
    })

    const newerItem = store.getState().items[0]
    expect(newerItem).toMatchObject({ status: 'checking', url })
    expect(newerItem.id).not.toBe(originalItem.id)

    controller.abort()
    await preparePromise

    expect(store.getState().items).toEqual([newerItem])
  })

  it('does not mark a newer same-URL item ready when an old run succeeds', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(21)
    let resolveParse: (listing: TruckListing) => void = () => undefined
    const parse = vi.fn(
      () =>
        new Promise<TruckListing>((resolve) => {
          resolveParse = resolve
        })
    )

    const preparePromise = prepareListingUrls({
      urls: [url],
      store,
      parse,
    })

    await waitUntil(() => parse.mock.calls.length === 1)

    const originalItem = store.getState().items[0]
    store.getState().remove(originalItem.id)
    store.getState().addUrls([url])

    const newerItem = store.getState().items[0]
    expect(newerItem.id).not.toBe(originalItem.id)

    resolveParse(createListing(url, 21))
    await preparePromise

    expect(store.getState().items).toEqual([newerItem])
  })

  it('does not mark a newer same-URL item failed when an old run fails', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(22)
    let rejectParse: (error: Error) => void = () => undefined
    const parse = vi.fn(
      () =>
        new Promise<TruckListing>((_, reject) => {
          rejectParse = reject
        })
    )

    const preparePromise = prepareListingUrls({
      urls: [url],
      store,
      parse,
    })

    await waitUntil(() => parse.mock.calls.length === 1)

    const originalItem = store.getState().items[0]
    store.getState().remove(originalItem.id)
    store.getState().addUrls([url])

    const newerItem = store.getState().items[0]
    expect(newerItem.id).not.toBe(originalItem.id)

    rejectParse(new Error('network failed'))
    await preparePromise

    expect(store.getState().items).toEqual([newerItem])
  })

  it('does not mark a newer same-URL item ready after reset re-adds it', async () => {
    const store = createPreparedListingStore()
    const url = buildUrl(23)
    let resolveParse: (listing: TruckListing) => void = () => undefined
    const parse = vi.fn(
      () =>
        new Promise<TruckListing>((resolve) => {
          resolveParse = resolve
        })
    )

    const preparePromise = prepareListingUrls({
      urls: [url],
      store,
      parse,
    })

    await waitUntil(() => parse.mock.calls.length === 1)

    const originalItem = store.getState().items[0]
    expect(originalItem).toMatchObject({
      status: 'checking',
      id: 'listing-1',
      url,
    })

    store.getState().reset()
    store.getState().addUrls([url])

    const newerItem = store.getState().items[0]
    expect(newerItem).toMatchObject({ status: 'checking', url })
    expect(newerItem.id).not.toBe(originalItem.id)

    resolveParse(createListing(url, 23))
    await preparePromise

    expect(store.getState().items).toEqual([newerItem])
  })
})
