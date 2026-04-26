import { describe, expect, it, vi } from 'vitest'

import { installRestoredTabReloadGuard } from '../restored-tab-reload'

interface FakePageTransitionEvent {
  persisted: boolean
}

function createWindowMock(navigationType: string) {
  const listeners = new Map<string, (event: FakePageTransitionEvent) => void>()
  const storage = new Map<string, string>()
  const reload = vi.fn()

  return {
    addEventListener: vi.fn(
      (name: string, listener: (event: FakePageTransitionEvent) => void) => {
        listeners.set(name, listener)
      }
    ),
    dispatchPageShow(persisted: boolean) {
      listeners.get('pageshow')?.({ persisted })
    },
    location: {
      reload,
    },
    performance: {
      getEntriesByType: vi.fn(() => [{ type: navigationType }]),
    },
    removeEventListener: vi.fn((name: string) => {
      listeners.delete(name)
    }),
    sessionStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      }),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
    },
  }
}

describe('installRestoredTabReloadGuard', () => {
  it('reloads once when the page is opened from browser restoration', () => {
    const windowMock = createWindowMock('back_forward')

    installRestoredTabReloadGuard(windowMock)
    installRestoredTabReloadGuard(windowMock)

    expect(windowMock.location.reload).toHaveBeenCalledTimes(1)
  })

  it('reloads once when pageshow reports a persisted restored page', () => {
    const windowMock = createWindowMock('navigate')

    installRestoredTabReloadGuard(windowMock)
    windowMock.dispatchPageShow(true)
    windowMock.dispatchPageShow(true)

    expect(windowMock.location.reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload on a normal navigation', () => {
    const windowMock = createWindowMock('navigate')

    installRestoredTabReloadGuard(windowMock)
    windowMock.dispatchPageShow(false)

    expect(windowMock.location.reload).not.toHaveBeenCalled()
  })
})
