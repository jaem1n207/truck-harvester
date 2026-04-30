import { createRequire } from 'node:module'

import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'
import { type WritableDirectoryHandle } from '@/v2/features/file-management'
import { onboardingStorageKey } from '@/v2/shared/model'

const analyticsMocks = vi.hoisted(() => ({
  createAnalyticsBatchId: vi.fn(() => 'batch-1'),
  trackBatchStarted: vi.fn(),
  trackListingFailed: vi.fn(),
  trackPreviewCompleted: vi.fn(),
  trackSaveCompleted: vi.fn(),
  trackSaveFailed: vi.fn(),
  trackSaveStarted: vi.fn(),
  trackUnsupportedInputFailure: vi.fn(),
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
  const parser = await vi.importActual<
    typeof import('@/v2/features/listing-preparation/model/url-input-parser')
  >('@/v2/features/listing-preparation/model/url-input-parser')

  listingPreparationMocks.prepareListingUrls.mockImplementation(
    prepare.prepareListingUrls
  )

  return {
    createPreparedListingStore: store.createPreparedListingStore,
    parseUrlInputText: parser.parseUrlInputText,
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

const createTestDirectoryHandle = (): WritableDirectoryHandle => ({
  getDirectoryHandle: async () => {
    throw new Error('테스트에서는 폴더에 쓰지 않습니다.')
  },
  getFileHandle: async () => {
    throw new Error('테스트에서는 파일에 쓰지 않습니다.')
  },
  name: 'truck-test',
  queryPermission: vi.fn().mockResolvedValue('granted'),
  requestPermission: vi.fn().mockResolvedValue('granted'),
})

const createRequest = <T,>(result: T): FakeIdbRequest<T> => ({
  error: null,
  onerror: null,
  onsuccess: null,
  result,
})

const markOnboardingComplete = () => {
  window.localStorage.setItem(onboardingStorageKey, 'completed')
}

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
  markOnboardingComplete()
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

describe('TruckHarvesterApp persistence', () => {
  it('disables the four background controls while onboarding is open', async () => {
    const restoredDirectory = createTestDirectoryHandle()

    installDom(restoredDirectory)
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('default'),
      },
    })
    const { TruckHarvesterApp } = await import('../truck-harvester-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterApp />)
    })

    const helpButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('도움말')
    )

    expect(helpButton).toBeInstanceOf(HTMLButtonElement)

    await act(async () => {
      helpButton?.dispatchEvent(
        new dom!.window.MouseEvent('click', { bubbles: true })
      )
    })

    const background = container.querySelector<HTMLElement>(
      '[data-tour-background="true"]'
    )
    const dialog = container.querySelector<HTMLElement>(
      '[data-tour-modal-root="true"]'
    )

    expect(dialog).toBeInstanceOf(HTMLElement)
    expect(background?.hasAttribute('inert')).toBe(true)
    expect(background?.getAttribute('aria-hidden')).toBeNull()

    const textarea = container.querySelector<HTMLTextAreaElement>(
      '#listing-chip-input-textarea'
    )
    const directoryButton = Array.from(
      container.querySelectorAll('button')
    ).find((button) => button.textContent === '저장 폴더 고르기')
    const notificationButton = Array.from(
      container.querySelectorAll('button')
    ).find((button) => button.textContent === '완료 알림 켜기')

    expect(helpButton?.disabled).toBe(true)
    expect(textarea?.disabled).toBe(true)
    expect(directoryButton?.disabled).toBe(true)
    expect(notificationButton?.disabled).toBe(true)
  })

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
    markOnboardingComplete()
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
    markOnboardingComplete()
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
  })

  it('renders a parsed listing in the input and status regions after paste', async () => {
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
    markOnboardingComplete()

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

    const inputRegion = container.querySelector(
      'section[aria-labelledby="listing-chip-input-title"]'
    )
    const statusRegion = container.querySelector(
      'section[aria-labelledby="prepared-listing-status-title"]'
    )

    expect(inputRegion?.textContent).toContain('현대 메가트럭')
    expect(inputRegion?.textContent).toContain('확인 완료')
    expect(statusRegion?.textContent).toContain('현대 메가트럭')
    expect(statusRegion?.textContent).toContain('저장 준비 완료')
  })

  it('shows guidance for unsupported non-empty pasted input without starting preview', async () => {
    const unsupportedInput =
      '  DetailView.asp?ShopNo=30195108&MemberNo=1000294965&OnCarNo=2026300055501\nabc...  '

    installDom({} as WritableDirectoryHandle)
    await renderTruckHarvesterApp()

    await pasteListingText(unsupportedInput)
    await flushAsyncUi(2)

    expect(container?.textContent).toContain(
      '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.'
    )
    expect(listingPreparationMocks.prepareListingUrls).not.toHaveBeenCalled()
  })

  it('shows guidance for empty pasted input without starting preview', async () => {
    installDom({} as WritableDirectoryHandle)
    await renderTruckHarvesterApp()

    await pasteListingText(' \n\t ')
    await flushAsyncUi(2)

    expect(listingPreparationMocks.prepareListingUrls).not.toHaveBeenCalled()
    expect(container?.textContent).toContain(
      '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.'
    )
  })

  it('extracts a valid listing url from surrounding prose', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=21'

    installDom({} as WritableDirectoryHandle)
    mockParseResponses([createTruckListing(truckUrl)])
    await renderTruckHarvesterApp()

    await pasteListingText(`확인 부탁드립니다\n${truckUrl}\nabc...`)
    await flushAsyncUi(4)

    expect(listingPreparationMocks.prepareListingUrls).toHaveBeenCalledTimes(1)
    expect(container?.textContent).toContain('현대 메가트럭')
  })

  it('renders preview failures as recoverable listing guidance', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=5'

    installDom({} as WritableDirectoryHandle)
    markOnboardingComplete()
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

    const inputRegion = container.querySelector(
      'section[aria-labelledby="listing-chip-input-title"]'
    )
    const statusRegion = container.querySelector(
      'section[aria-labelledby="prepared-listing-status-title"]'
    )

    expect(inputRegion?.textContent).toContain('확인 필요')
    expect(inputRegion?.textContent).toContain(
      '확인하지 못한 매물은 지우고 다시 붙여넣어 주세요.'
    )
    expect(statusRegion?.textContent).toContain(
      '매물 이름을 확인하지 못했어요. 잠시 후 다시 붙여넣어 주세요.'
    )
  })

  it('keeps latest duplicate helper text when an older preview resolves later', async () => {
    const olderTruckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=7'
    const newerTruckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=8'
    const olderPreview = createDeferred<Response>()

    installDom({} as WritableDirectoryHandle)
    markOnboardingComplete()
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
  })

  it('renders invalid listing identity as address-check guidance', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=6'

    installDom({} as WritableDirectoryHandle)
    markOnboardingComplete()
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

    const inputRegion = container.querySelector(
      'section[aria-labelledby="listing-chip-input-title"]'
    )
    const statusRegion = container.querySelector(
      'section[aria-labelledby="prepared-listing-status-title"]'
    )

    expect(inputRegion?.textContent).toContain('확인 필요')
    expect(statusRegion?.textContent).toContain(
      '매물 정보를 찾지 못했어요. 주소를 다시 확인해 주세요.'
    )
  })

  it('keeps partial directory save failures separate from saved listings', async () => {
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

    installDom(restoredDirectory)
    mockParseResponses([savedListing, failedListing])
    await renderTruckHarvesterApp()
    await selectSaveDirectory(restoredDirectory)

    await pasteListingText(`${savedUrl}\n${failedUrl}`)
    await flushAsyncUi()
    await startSavingReadyListings()
    await flushAsyncUi(6)

    const statusRegion = container?.querySelector(
      'section[aria-labelledby="prepared-listing-status-title"]'
    )
    const inputRegion = container?.querySelector(
      'section[aria-labelledby="listing-chip-input-title"]'
    )

    expect(statusRegion?.textContent).toContain('현대 메가트럭')
    expect(statusRegion?.textContent).toContain('저장 완료')
    expect(statusRegion?.textContent).toContain(
      '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
    )
    expect(inputRegion?.textContent).not.toContain('현대 메가트럭')
    expect(inputRegion?.textContent).toContain('확인 필요')
  })

  it('shows a recoverable failure when zip fallback cannot be created', async () => {
    const truckUrl =
      'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=15'
    const listing = createTruckListing(truckUrl, {
      vname: '현대 엑시언트',
      vehicleName: '현대 엑시언트',
      vnumber: '대구55마5555',
    })

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

    const statusRegion = container?.querySelector(
      'section[aria-labelledby="prepared-listing-status-title"]'
    )

    expect(statusRegion?.textContent).toContain(
      '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
    )
  })
})
