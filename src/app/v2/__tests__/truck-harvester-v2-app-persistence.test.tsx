import { createRequire } from 'node:module'

import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type WritableDirectoryHandle } from '@/v2/features/file-management'

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
    HTMLElement: {
      configurable: true,
      value: dom.window.HTMLElement,
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
})
