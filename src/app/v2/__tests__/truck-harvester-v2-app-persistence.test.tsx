import { createRequire } from 'node:module'

import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type WritableDirectoryHandle } from '@/v2/features/file-management'
import { prepareListingUrls } from '@/v2/features/listing-preparation/model/prepare-listings'
import {
  createPreparedListingStore,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
} from '@/v2/features/listing-preparation/model/prepared-listing-store'

interface JsdomInstance {
  window: Window & typeof globalThis
}

const require = createRequire(import.meta.url)
const { mock } = require('bun:test') as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void
  }
}
const { JSDOM } = require('jsdom') as {
  JSDOM: new (html: string, options: { url: string }) => JsdomInstance
}

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

mock.module('@/v2/features/listing-preparation', () => {
  return {
    createPreparedListingStore,
    prepareListingUrls,
    selectCheckingPreparedListings,
    selectReadyPreparedListings,
  }
})

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

const createRequest = <T,>(result: T): FakeIdbRequest<T> => ({
  error: null,
  onerror: null,
  onsuccess: null,
  result,
})

const installDom = (storedDirectory: WritableDirectoryHandle) => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/v2',
  })

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

      dom?.window.setTimeout(() => {
        request.onsuccess?.()
      }, 0)

      return request
    },
  }

  Object.defineProperties(globalThis, {
    document: {
      configurable: true,
      value: dom.window.document,
    },
    DOMException: {
      configurable: true,
      value: dom.window.DOMException,
    },
    Event: {
      configurable: true,
      value: dom.window.Event,
    },
    HTMLElement: {
      configurable: true,
      value: dom.window.HTMLElement,
    },
    HTMLButtonElement: {
      configurable: true,
      value: dom.window.HTMLButtonElement,
    },
    HTMLTextAreaElement: {
      configurable: true,
      value: dom.window.HTMLTextAreaElement,
    },
    indexedDB: {
      configurable: true,
      value: indexedDB,
    },
    MutationObserver: {
      configurable: true,
      value: dom.window.MutationObserver,
    },
    navigator: {
      configurable: true,
      value: dom.window.navigator,
    },
    window: {
      configurable: true,
      value: dom.window,
    },
  })

  Object.defineProperty(dom.window, 'showDirectoryPicker', {
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
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: originalFetch,
  })
})

describe('TruckHarvesterV2App persistence', () => {
  it('restores a persisted writable folder after client mount', async () => {
    const queryPermission = vi.fn().mockResolvedValue('granted')
    const restoredDirectory: WritableDirectoryHandle = {
      getDirectoryHandle: async () => {
        throw new Error('테스트에서는 폴더에 쓰지 않습니다.')
      },
      getFileHandle: async () => {
        throw new Error('테스트에서는 파일에 쓰지 않습니다.')
      },
      name: 'truck-test',
      queryPermission,
    }

    installDom(restoredDirectory)
    const { TruckHarvesterV2App } = await import('../truck-harvester-v2-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterV2App />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    expect(container.textContent).toContain('선택한 저장 폴더')
    expect(container.textContent).toContain('truck-test')
    expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
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
    const { TruckHarvesterV2App } = await import('../truck-harvester-v2-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterV2App />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
    }

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    expect(textarea).toBeInstanceOf(HTMLTextAreaElement)

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
      textarea?.dispatchEvent(pasteEvent)
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
})
