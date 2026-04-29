import { createRequire } from 'node:module'

import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'
import { type WritableDirectoryHandle } from '@/v2/features/file-management'
import { type PrepareListingUrlsInput } from '@/v2/features/listing-preparation'

const analyticsMocks = vi.hoisted(() => ({
  createAnalyticsBatchId: vi.fn(() => 'batch-1'),
  trackBatchStarted: vi.fn(),
  trackListingFailed: vi.fn(),
  trackPreviewCompleted: vi.fn(),
  trackSaveCompleted: vi.fn(),
  trackSaveFailed: vi.fn(),
  trackSaveStarted: vi.fn(),
}))

const listingPreparationMocks = vi.hoisted(() => ({
  prepareListingUrls: vi.fn(),
}))

vi.mock('@/v2/shared/lib/analytics', () => analyticsMocks)

vi.mock('@/v2/features/listing-preparation', async () => {
  const prepare = await vi.importActual<
    typeof import('@/v2/features/listing-preparation/model/prepare-listings')
  >('@/v2/features/listing-preparation/model/prepare-listings')
  const store = await vi.importActual<
    typeof import('@/v2/features/listing-preparation/model/prepared-listing-store')
  >('@/v2/features/listing-preparation/model/prepared-listing-store')

  listingPreparationMocks.prepareListingUrls.mockImplementation(
    prepare.prepareListingUrls
  )

  return {
    createPreparedListingStore: store.createPreparedListingStore,
    prepareListingUrls: listingPreparationMocks.prepareListingUrls,
    selectCheckingPreparedListings: store.selectCheckingPreparedListings,
    selectReadyPreparedListings: store.selectReadyPreparedListings,
  }
})

interface JsdomInstance {
  window: Window & typeof globalThis
}

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom') as {
  JSDOM: new (html: string, options: { url: string }) => JsdomInstance
}

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

interface FakeIdbRequest<T> {
  error: Error | null
  onerror: (() => void) | null
  onsuccess: (() => void) | null
  result: T | null
}

interface FakeIdbTransaction {
  error: Error | null
  onabort: (() => void) | null
  oncomplete: (() => void) | null
  objectStore: () => {
    get: () => FakeIdbRequest<WritableDirectoryHandle>
    put: () => FakeIdbRequest<WritableDirectoryHandle>
  }
}

let root: Root | null = null
let container: HTMLDivElement | null = null
let dom: JsdomInstance | null = null
const originalFetch = globalThis.fetch
const originalCreateObjectUrl = URL.createObjectURL
const originalRevokeObjectUrl = URL.revokeObjectURL

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

const createRequest = <T,>(result: T): FakeIdbRequest<T> => ({
  error: null,
  onerror: null,
  onsuccess: null,
  result,
})

const installDom = (storedDirectory: WritableDirectoryHandle) => {
  const currentDom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  })
  dom = currentDom

  const database = {
    close: vi.fn(),
    transaction: () => {
      const transaction: FakeIdbTransaction = {
        error: null,
        onabort: null,
        oncomplete: null,
        objectStore: () => ({
          get: () => {
            const request = createRequest(storedDirectory)

            window.setTimeout(() => {
              request.onsuccess?.()
              transaction.oncomplete?.()
            }, 0)

            return request
          },
          put: () => {
            const request = createRequest(storedDirectory)

            window.setTimeout(() => {
              request.onsuccess?.()
              transaction.oncomplete?.()
            }, 0)

            return request
          },
        }),
      }

      return transaction
    },
  }
  const indexedDB = {
    open: () => {
      const request = createRequest(database)

      currentDom.window.setTimeout(() => {
        request.onsuccess?.()
      }, 0)

      return request
    },
  }

  Object.defineProperties(globalThis, {
    document: {
      configurable: true,
      value: currentDom.window.document,
    },
    DOMException: {
      configurable: true,
      value: currentDom.window.DOMException,
    },
    Event: {
      configurable: true,
      value: currentDom.window.Event,
    },
    HTMLElement: {
      configurable: true,
      value: currentDom.window.HTMLElement,
    },
    HTMLButtonElement: {
      configurable: true,
      value: currentDom.window.HTMLButtonElement,
    },
    HTMLTextAreaElement: {
      configurable: true,
      value: currentDom.window.HTMLTextAreaElement,
    },
    indexedDB: {
      configurable: true,
      value: indexedDB,
    },
    MutationObserver: {
      configurable: true,
      value: currentDom.window.MutationObserver,
    },
    navigator: {
      configurable: true,
      value: currentDom.window.navigator,
    },
    window: {
      configurable: true,
      value: currentDom.window,
    },
  })

  Object.defineProperty(currentDom.window, 'showDirectoryPicker', {
    configurable: true,
    value: vi.fn(),
  })
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }

  container?.remove()
  root = null
  container = null
  dom?.window.close()
  dom = null
  vi.clearAllMocks()
  analyticsMocks.createAnalyticsBatchId.mockReset()
  analyticsMocks.createAnalyticsBatchId.mockImplementation(() => 'batch-1')
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: originalFetch,
  })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectUrl,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectUrl,
  })
})

const expectNoVehicleIdentity = (payload: object | undefined) => {
  expect(payload).toBeDefined()
  expect(payload).not.toHaveProperty('vehicleNumber')
  expect(payload).not.toHaveProperty('vehicleName')
}

const createTruckListing = (
  url: string,
  overrides: Partial<TruckListing> = {}
): TruckListing => ({
  url,
  vname: overrides.vname ?? '현대 메가트럭',
  vehicleName: overrides.vehicleName ?? overrides.vname ?? '현대 메가트럭',
  vnumber: overrides.vnumber ?? '서울12가3456',
  price: overrides.price ?? {
    raw: 3200,
    rawWon: 32000000,
    label: '3,200만원',
    compactLabel: '3,200만원',
  },
  year: overrides.year ?? '2020',
  mileage: overrides.mileage ?? '120,000km',
  options: overrides.options ?? '윙바디',
  images: overrides.images ?? [],
})

const mockParseResponses = (listings: readonly TruckListing[]) => {
  const listingsByUrl = new Map(
    listings.map((listing) => [listing.url, listing])
  )

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { url: string }
      const listing = listingsByUrl.get(requestBody.url)

      if (!listing) {
        return Promise.reject(new Error('예상하지 못한 테스트 주소입니다.'))
      }

      return Promise.resolve(
        Response.json({
          success: true,
          data: listing,
        })
      )
    }),
  })
}

const createWritableDirectory = (
  failingFolderNames: ReadonlySet<string> = new Set()
): WritableDirectoryHandle => {
  const writable = {
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
  }
  const fileHandle = {
    createWritable: vi.fn().mockResolvedValue(writable),
  }
  const vehicleDirectory: WritableDirectoryHandle = {
    getDirectoryHandle: async () => vehicleDirectory,
    getFileHandle: vi.fn().mockResolvedValue(fileHandle),
    name: 'vehicle-directory',
  }

  return {
    getDirectoryHandle: vi.fn((name: string) => {
      if (failingFolderNames.has(name)) {
        return Promise.reject(new Error('disk full'))
      }

      return Promise.resolve(vehicleDirectory)
    }),
    getFileHandle: vi.fn().mockResolvedValue(fileHandle),
    name: 'truck-test',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  }
}

const flushAsyncUi = async (iterations = 4) => {
  for (let index = 0; index < iterations; index += 1) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
  }
}

const renderTruckHarvesterApp = async () => {
  const { TruckHarvesterApp } = await import('../truck-harvester-app')

  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(<TruckHarvesterApp />)
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

const getTextArea = () => {
  const textarea = container?.querySelector(
    'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
  )

  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('매물 주소 입력란을 찾지 못했습니다.')
  }

  return textarea
}

const pasteListingText = async (text: string) => {
  const pasteEvent = new Event('paste', {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: { getData: () => text },
  })

  await act(async () => {
    getTextArea().dispatchEvent(pasteEvent)
  })
}

const selectSaveDirectory = async (directory: WritableDirectoryHandle) => {
  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    value: vi.fn().mockResolvedValue(directory),
  })

  const folderButton = Array.from(
    container?.querySelectorAll('button') ?? []
  ).find((button) => button.textContent === '저장 폴더 고르기')

  expect(folderButton).toBeInstanceOf(HTMLButtonElement)

  await act(async () => {
    folderButton?.dispatchEvent(
      new dom!.window.MouseEvent('click', { bubbles: true })
    )
  })

  await flushAsyncUi(2)
}

const startSavingReadyListings = async () => {
  const startButton = Array.from(
    container?.querySelectorAll('button') ?? []
  ).find((button) => button.textContent?.includes('저장 시작'))

  expect(startButton).toBeInstanceOf(HTMLButtonElement)

  await act(async () => {
    startButton?.dispatchEvent(
      new dom!.window.MouseEvent('click', { bubbles: true })
    )
  })
}

const disableFileSystemAccess = () => {
  if (typeof window !== 'undefined') {
    Reflect.deleteProperty(window, 'showDirectoryPicker')
  }
}

const getSaveListingFailures = () =>
  analyticsMocks.trackListingFailed.mock.calls
    .map(([payload]) => payload)
    .filter((payload) => payload.failureStage === 'save')

describe('TruckHarvesterApp persistence', () => {
  it('does not restore a persisted writable folder after client mount', async () => {
    const queryPermission = vi.fn().mockResolvedValue('granted')
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const restoredDirectory: WritableDirectoryHandle = {
      getDirectoryHandle: async () => {
        throw new Error('테스트에서는 폴더에 쓰지 않습니다.')
      },
      getFileHandle: async () => {
        throw new Error('테스트에서는 파일에 쓰지 않습니다.')
      },
      name: 'truck-test',
      queryPermission,
      requestPermission,
    }

    installDom(restoredDirectory)
    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(container.textContent).not.toContain('선택한 저장 폴더')
    expect(container.textContent).not.toContain('truck-test')
    expect(queryPermission).not.toHaveBeenCalled()
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('keeps a saved listing in the status region while removing it from the input region', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
    const queryPermission = vi.fn().mockResolvedValue('granted')
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const writable = {
      close: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const fileHandle = {
      createWritable: vi.fn().mockResolvedValue(writable),
    }
    const vehicleDirectory = {
      getFileHandle: vi.fn().mockResolvedValue(fileHandle),
    }
    const restoredDirectory: WritableDirectoryHandle = {
      getDirectoryHandle: vi.fn().mockResolvedValue(vehicleDirectory),
      getFileHandle: vi.fn().mockResolvedValue(fileHandle),
      name: 'truck-test',
      queryPermission,
      requestPermission,
    }

    installDom(restoredDirectory)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              url: truckUrl,
              vname: '현대 메가트럭',
              vehicleName: '현대 메가트럭',
              vnumber: '서울12가3456',
              price: {
                raw: 3200,
                rawWon: 32000000,
                label: '3,200만원',
                compactLabel: '3,200만원',
              },
              year: '2020',
              mileage: '120,000km',
              options: '윙바디',
              images: [],
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      ),
    })
    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue(restoredDirectory),
    })

    const folderButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '저장 폴더 고르기'
    )

    expect(folderButton).toBeInstanceOf(HTMLButtonElement)

    await act(async () => {
      folderButton?.dispatchEvent(
        new dom!.window.MouseEvent('click', { bubbles: true })
      )
    })

    for (let index = 0; index < 2; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('매물 주소 입력란을 찾지 못했습니다.')
    }
    const textareaElement = textarea

    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })

    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => truckUrl,
      },
    })

    await act(async () => {
      textareaElement.dispatchEvent(pasteEvent)
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    const inputRegion = container.querySelector(
      'section[aria-labelledby="listing-chip-input-title"]'
    )
    const statusRegion = container.querySelector(
      'section[aria-labelledby="prepared-listing-status-title"]'
    )

    expect(inputRegion?.textContent).toContain('현대 메가트럭')
    expect(statusRegion?.textContent).toContain('현대 메가트럭')

    const startButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '확인된 1대 저장 시작'
    )

    expect(startButton).toBeInstanceOf(HTMLButtonElement)

    await act(async () => {
      startButton?.dispatchEvent(
        new dom!.window.MouseEvent('click', { bubbles: true })
      )
    })

    for (let index = 0; index < 6; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(statusRegion?.textContent).toContain('현대 메가트럭')
    expect(statusRegion?.textContent).toContain('저장 완료')
    expect(inputRegion?.textContent).not.toContain('현대 메가트럭')
    expect(analyticsMocks.trackSaveStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        saveMethod: 'directory',
        readyCount: 1,
      })
    )
    expect(analyticsMocks.trackSaveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        saveMethod: 'directory',
        savedCount: 1,
        saveFailedCount: 0,
      })
    )
    expect(analyticsMocks.trackSaveFailed).not.toHaveBeenCalled()
  })

  it('tracks batch and preview completion without success listing identifiers', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

    installDom({
      getDirectoryHandle: async () => {
        throw new Error('테스트에서는 폴더에 쓰지 않습니다.')
      },
      getFileHandle: async () => {
        throw new Error('테스트에서는 파일에 쓰지 않습니다.')
      },
      name: 'truck-test',
    } as WritableDirectoryHandle)

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              url: truckUrl,
              vname: '현대 메가트럭',
              vehicleName: '현대 메가트럭',
              vnumber: '서울12가3456',
              price: {
                raw: 3200,
                rawWon: 32000000,
                label: '3,200만원',
                compactLabel: '3,200만원',
              },
              year: '2020',
              mileage: '120,000km',
              options: '윙바디',
              images: [],
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      ),
    })

    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('매물 주소 입력란을 찾지 못했습니다.')
    }

    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })

    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => truckUrl,
      },
    })

    await act(async () => {
      textarea.dispatchEvent(pasteEvent)
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(analyticsMocks.trackBatchStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        urlCount: 1,
        uniqueUrlCount: 1,
        readyCount: 0,
        invalidCount: 0,
        previewFailedCount: 0,
        savedCount: 0,
        saveFailedCount: 0,
      })
    )
    expect(analyticsMocks.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        urlCount: 1,
        uniqueUrlCount: 1,
        readyCount: 1,
        invalidCount: 0,
        previewFailedCount: 0,
      })
    )
    expect(analyticsMocks.trackListingFailed).not.toHaveBeenCalled()
  })

  it('tracks preview failures with listing url but without vehicle identifiers', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=5'

    installDom({} as WritableDirectoryHandle)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn().mockResolvedValue(
        Response.json(
          {
            success: false,
            reason: 'site-timeout',
            message: '사이트 응답이 늦습니다.',
          },
          { status: 504 }
        )
      ),
    })

    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('매물 주소 입력란을 찾지 못했습니다.')
    }

    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: () => truckUrl },
    })

    await act(async () => {
      textarea.dispatchEvent(pasteEvent)
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(analyticsMocks.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        previewFailedCount: 1,
      })
    )
    expect(analyticsMocks.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        failureStage: 'preview',
        listingUrl: truckUrl,
      })
    )

    const previewFailurePayload =
      analyticsMocks.trackListingFailed.mock.calls.find(
        ([payload]) =>
          payload.failureStage === 'preview' && payload.listingUrl === truckUrl
      )?.[0]

    expectNoVehicleIdentity(previewFailurePayload)
  })

  it('tracks superseded preview runs without overwriting latest duplicate helper text', async () => {
    const olderTruckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=7'
    const newerTruckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=8'
    const olderPreview = createDeferred<Response>()

    analyticsMocks.createAnalyticsBatchId
      .mockReturnValueOnce('batch-old')
      .mockReturnValueOnce('batch-latest')

    installDom({} as WritableDirectoryHandle)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
        const requestBody = JSON.parse(String(init?.body)) as { url: string }

        if (requestBody.url === olderTruckUrl) {
          return olderPreview.promise
        }

        if (requestBody.url === newerTruckUrl) {
          return Promise.resolve(
            Response.json({
              success: true,
              data: {
                url: newerTruckUrl,
                vname: '현대 메가트럭',
                vehicleName: '현대 메가트럭',
                vnumber: '서울12가3456',
                price: {
                  raw: 3200,
                  rawWon: 32000000,
                  label: '3,200만원',
                  compactLabel: '3,200만원',
                },
                year: '2020',
                mileage: '120,000km',
                options: '윙바디',
                images: [],
              },
            })
          )
        }

        return Promise.reject(new Error('예상하지 못한 테스트 주소입니다.'))
      }),
    })

    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('매물 주소 입력란을 찾지 못했습니다.')
    }

    const olderPasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(olderPasteEvent, 'clipboardData', {
      value: { getData: () => olderTruckUrl },
    })

    await act(async () => {
      textarea.dispatchEvent(olderPasteEvent)
    })

    await act(async () => {
      await Promise.resolve()
    })

    const newerPasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(newerPasteEvent, 'clipboardData', {
      value: { getData: () => `${olderTruckUrl}\n${newerTruckUrl}` },
    })

    await act(async () => {
      textarea.dispatchEvent(newerPasteEvent)
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(container.textContent).toContain('이미 넣은 매물이에요.')

    olderPreview.resolve(
      Response.json(
        {
          success: false,
          reason: 'site-timeout',
          message: '사이트 응답이 늦습니다.',
        },
        { status: 504 }
      )
    )

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(container.textContent).toContain('이미 넣은 매물이에요.')
    expect(analyticsMocks.trackBatchStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-old',
        urlCount: 1,
        uniqueUrlCount: 1,
      })
    )
    expect(analyticsMocks.trackBatchStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-latest',
        urlCount: 2,
        uniqueUrlCount: 2,
      })
    )
    expect(analyticsMocks.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-latest',
        urlCount: 2,
        uniqueUrlCount: 1,
        readyCount: 1,
        previewFailedCount: 0,
      })
    )
    expect(analyticsMocks.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-old',
        urlCount: 1,
        uniqueUrlCount: 1,
        readyCount: 0,
        previewFailedCount: 1,
      })
    )

    const olderFailurePayload =
      analyticsMocks.trackListingFailed.mock.calls.find(
        ([payload]) =>
          payload.failureStage === 'preview' &&
          payload.listingUrl === olderTruckUrl
      )?.[0]

    expect(olderFailurePayload).toEqual(
      expect.objectContaining({
        batchId: 'batch-old',
        failureStage: 'preview',
        listingUrl: olderTruckUrl,
      })
    )
    expectNoVehicleIdentity(olderFailurePayload)
  })

  it('does not attach an old same-url preview run to a newer pasted item', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=9'
    const oldPreview = createDeferred<Response>()

    analyticsMocks.createAnalyticsBatchId
      .mockReturnValueOnce('batch-old')
      .mockReturnValueOnce('batch-new')

    installDom({} as WritableDirectoryHandle)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi
        .fn()
        .mockReturnValueOnce(oldPreview.promise)
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            data: {
              url: truckUrl,
              vname: '현대 메가트럭',
              vehicleName: '현대 메가트럭',
              vnumber: '서울12가3456',
              price: {
                raw: 3200,
                rawWon: 32000000,
                label: '3,200만원',
                compactLabel: '3,200만원',
              },
              year: '2020',
              mileage: '120,000km',
              options: '윙바디',
              images: [],
            },
          })
        ),
    })

    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('매물 주소 입력란을 찾지 못했습니다.')
    }

    const oldPasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(oldPasteEvent, 'clipboardData', {
      value: { getData: () => truckUrl },
    })

    await act(async () => {
      textarea.dispatchEvent(oldPasteEvent)
    })

    for (let index = 0; index < 2; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    const removeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.startsWith('매물 지우기:')
    )

    expect(removeButton).toBeInstanceOf(HTMLButtonElement)

    await act(async () => {
      removeButton?.dispatchEvent(
        new dom!.window.MouseEvent('click', { bubbles: true })
      )
    })

    const newPasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(newPasteEvent, 'clipboardData', {
      value: { getData: () => truckUrl },
    })

    await act(async () => {
      textarea.dispatchEvent(newPasteEvent)
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(analyticsMocks.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-new',
        uniqueUrlCount: 1,
        readyCount: 1,
        previewFailedCount: 0,
      })
    )

    oldPreview.resolve(
      Response.json(
        {
          success: false,
          reason: 'site-timeout',
          message: '사이트 응답이 늦습니다.',
        },
        { status: 504 }
      )
    )

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(analyticsMocks.trackPreviewCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-old',
        uniqueUrlCount: 1,
        readyCount: 0,
        previewFailedCount: 1,
      })
    )
    expect(analyticsMocks.trackPreviewCompleted).not.toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-old',
        uniqueUrlCount: 1,
        readyCount: 1,
      })
    )
    expect(analyticsMocks.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-old',
        failureStage: 'preview',
        listingUrl: truckUrl,
      })
    )
  })

  it('tracks invalid listing identity as an invalid_url failure', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=6'

    installDom({} as WritableDirectoryHandle)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: {
            url: truckUrl,
            vname: '차명 정보 없음',
            vehicleName: '차명 정보 없음',
            vnumber: '서울12가3456',
            price: {
              raw: 0,
              rawWon: 0,
              label: '가격 정보 없음',
              compactLabel: '가격 정보 없음',
            },
            year: '2020',
            mileage: '120,000km',
            options: '윙바디',
            images: [],
          },
        })
      ),
    })

    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('매물 주소 입력란을 찾지 못했습니다.')
    }

    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: () => truckUrl },
    })

    await act(async () => {
      textarea.dispatchEvent(pasteEvent)
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(analyticsMocks.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        failureStage: 'invalid_url',
        listingUrl: truckUrl,
      })
    )

    const invalidFailurePayload =
      analyticsMocks.trackListingFailed.mock.calls.find(
        ([payload]) =>
          payload.failureStage === 'invalid_url' &&
          payload.listingUrl === truckUrl
      )?.[0]

    expectNoVehicleIdentity(invalidFailurePayload)
  })

  it('tracks save summaries per paste batch when saving ready listings together', async () => {
    const firstUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=11'
    const secondUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=12'
    const firstListing = createTruckListing(firstUrl, {
      vname: '현대 메가트럭',
      vnumber: '서울11가1111',
    })
    const secondListing = createTruckListing(secondUrl, {
      vname: '기아 봉고',
      vnumber: '부산22나2222',
    })
    const restoredDirectory = createWritableDirectory()

    analyticsMocks.createAnalyticsBatchId
      .mockReturnValueOnce('batch-first')
      .mockReturnValueOnce('batch-second')

    installDom(restoredDirectory)
    mockParseResponses([firstListing, secondListing])
    await renderTruckHarvesterApp()
    await selectSaveDirectory(restoredDirectory)

    await pasteListingText(firstUrl)
    await flushAsyncUi()
    await pasteListingText(secondUrl)
    await flushAsyncUi()
    await startSavingReadyListings()
    await flushAsyncUi(6)

    expect(analyticsMocks.trackSaveStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-first',
        saveMethod: 'directory',
        readyCount: 1,
      })
    )
    expect(analyticsMocks.trackSaveStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-second',
        saveMethod: 'directory',
        readyCount: 1,
      })
    )
    expect(analyticsMocks.trackSaveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-first',
        savedCount: 1,
        saveFailedCount: 0,
      })
    )
    expect(analyticsMocks.trackSaveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-second',
        savedCount: 1,
        saveFailedCount: 0,
      })
    )
    expect(analyticsMocks.trackSaveFailed).not.toHaveBeenCalled()
  })

  it('tracks partial directory save failures without failing saved listings', async () => {
    const savedUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=13'
    const failedUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=14'
    const savedListing = createTruckListing(savedUrl, {
      vname: '현대 메가트럭',
      vnumber: '서울33다3333',
    })
    const failedListing = createTruckListing(failedUrl, {
      vname: '대우 프리마',
      vehicleName: '대우 프리마',
      vnumber: '인천44라4444',
    })
    const restoredDirectory = createWritableDirectory(
      new Set([failedListing.vnumber])
    )

    analyticsMocks.createAnalyticsBatchId.mockReturnValueOnce('batch-partial')

    installDom(restoredDirectory)
    mockParseResponses([savedListing, failedListing])
    await renderTruckHarvesterApp()
    await selectSaveDirectory(restoredDirectory)

    await pasteListingText(`${savedUrl}\n${failedUrl}`)
    await flushAsyncUi()
    await startSavingReadyListings()
    await flushAsyncUi(6)

    expect(analyticsMocks.trackSaveFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-partial',
        saveMethod: 'directory',
        readyCount: 2,
        savedCount: 1,
        saveFailedCount: 1,
      })
    )
    expect(analyticsMocks.trackSaveCompleted).not.toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-partial',
      })
    )

    const saveFailures = getSaveListingFailures()

    expect(saveFailures).toHaveLength(1)
    expect(saveFailures[0]).toEqual(
      expect.objectContaining({
        batchId: 'batch-partial',
        listingUrl: failedUrl,
        vehicleNumber: '인천44라4444',
        vehicleName: '대우 프리마',
      })
    )
  })

  it('tracks zip fallback failures as zip save failures', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=15'
    const listing = createTruckListing(truckUrl, {
      vname: '현대 엑시언트',
      vehicleName: '현대 엑시언트',
      vnumber: '대구55마5555',
    })

    analyticsMocks.createAnalyticsBatchId.mockReturnValueOnce('batch-zip')

    installDom({} as WritableDirectoryHandle)
    disableFileSystemAccess()
    mockParseResponses([listing])
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('zip blocked')
      }),
    })
    await renderTruckHarvesterApp()

    await pasteListingText(truckUrl)
    await flushAsyncUi()
    await startSavingReadyListings()
    await flushAsyncUi(6)

    expect(analyticsMocks.trackSaveStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-zip',
        saveMethod: 'zip',
      })
    )
    expect(analyticsMocks.trackSaveFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-zip',
        saveMethod: 'zip',
        saveFailedCount: 1,
      })
    )
    expect(getSaveListingFailures()).toEqual([
      expect.objectContaining({
        batchId: 'batch-zip',
        listingUrl: truckUrl,
        vehicleNumber: '대구55마5555',
        vehicleName: '현대 엑시언트',
      }),
    ])
  })

  it('uses a fallback save batch when a ready listing has no preview mapping', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=16'
    const listing = createTruckListing(truckUrl, {
      vname: '타타대우 노부스',
      vehicleName: '타타대우 노부스',
      vnumber: '광주66바6666',
    })
    const restoredDirectory = createWritableDirectory()

    analyticsMocks.createAnalyticsBatchId
      .mockReturnValueOnce('batch-preview')
      .mockReturnValueOnce('batch-fallback')
    listingPreparationMocks.prepareListingUrls.mockImplementationOnce(
      async ({ urls, store }: PrepareListingUrlsInput) => {
        const result = store.getState().addUrls([...urls])
        const item = store
          .getState()
          .items.find(
            (entry) => entry.url === truckUrl && entry.status === 'checking'
          )

        if (!item) {
          throw new Error('테스트 매물을 준비하지 못했습니다.')
        }

        store.getState().markReadyById(item.id, listing)

        return {
          ...result,
          addedItems: [],
          settledItems: [
            {
              id: item.id,
              url: truckUrl,
              status: 'ready' as const,
            },
          ],
        }
      }
    )

    installDom(restoredDirectory)
    await renderTruckHarvesterApp()
    await selectSaveDirectory(restoredDirectory)

    await pasteListingText(truckUrl)
    await flushAsyncUi()
    await startSavingReadyListings()
    await flushAsyncUi(6)

    expect(analyticsMocks.trackSaveStarted).not.toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-preview',
      })
    )
    expect(analyticsMocks.trackSaveStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-fallback',
        saveMethod: 'directory',
        readyCount: 1,
      })
    )
    expect(analyticsMocks.trackSaveCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-fallback',
        saveMethod: 'directory',
        savedCount: 1,
        saveFailedCount: 0,
      })
    )
  })

  it('tracks save failures with vehicle identifiers for parsed listings', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=7'
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const restoredDirectory: WritableDirectoryHandle = {
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('disk full')),
      getFileHandle: async () => {
        throw new Error('테스트에서는 파일에 쓰지 않습니다.')
      },
      name: 'truck-test',
      requestPermission,
    }

    installDom(restoredDirectory)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: {
            url: truckUrl,
            vname: '현대 메가트럭',
            vehicleName: '현대 메가트럭',
            vnumber: '서울12가3456',
            price: {
              raw: 3200,
              rawWon: 32000000,
              label: '3,200만원',
              compactLabel: '3,200만원',
            },
            year: '2020',
            mileage: '120,000km',
            options: '윙바디',
            images: [],
          },
        })
      ),
    })

    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue(restoredDirectory),
    })

    const folderButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '저장 폴더 고르기'
    )
    await act(async () => {
      folderButton?.dispatchEvent(
        new dom!.window.MouseEvent('click', { bubbles: true })
      )
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('매물 주소 입력란을 찾지 못했습니다.')
    }

    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: () => truckUrl },
    })

    await act(async () => {
      textarea.dispatchEvent(pasteEvent)
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    const startButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '확인된 1대 저장 시작'
    )

    await act(async () => {
      startButton?.dispatchEvent(
        new dom!.window.MouseEvent('click', { bubbles: true })
      )
    })

    for (let index = 0; index < 6; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(analyticsMocks.trackSaveFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        saveMethod: 'directory',
        saveFailedCount: 1,
      })
    )
    expect(analyticsMocks.trackListingFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'batch-1',
        failureStage: 'save',
        listingUrl: truckUrl,
        vehicleNumber: '서울12가3456',
        vehicleName: '현대 메가트럭',
        imageCount: 0,
      })
    )
  })
})
