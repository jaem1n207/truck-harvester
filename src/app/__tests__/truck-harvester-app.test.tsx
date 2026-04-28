import { createRequire } from 'node:module'

import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type WritableDirectoryHandle } from '@/v2/features/file-management'
import { onboardingStorageKey } from '@/v2/shared/model'

vi.mock('@/v2/features/listing-preparation', async () => {
  const prepare = await vi.importActual<
    typeof import('@/v2/features/listing-preparation/model/prepare-listings')
  >('@/v2/features/listing-preparation/model/prepare-listings')
  const store = await vi.importActual<
    typeof import('@/v2/features/listing-preparation/model/prepared-listing-store')
  >('@/v2/features/listing-preparation/model/prepared-listing-store')

  return {
    createPreparedListingStore: store.createPreparedListingStore,
    prepareListingUrls: prepare.prepareListingUrls,
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
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: originalFetch,
  })
})

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
})
