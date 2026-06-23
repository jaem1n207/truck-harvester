import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CARMODOO_RENDER_VIEWPORT,
  renderCarmodooNativeImagesWithBrowser,
  renderCarmodooNativeImagesWithLauncher,
} from '../carmodoo-native-renderer'

const carmodooUrl =
  'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function createRendererBrowser({
  elements = [
    {
      screenshot: vi.fn(async () => Buffer.from([1, 2, 3])),
    },
  ],
  goto = vi.fn(),
  waitForSelector = vi.fn(),
} = {}) {
  const page = {
    $$: vi.fn(async () => elements),
    addStyleTag: vi.fn(),
    close: vi.fn(),
    goto,
    setViewportSize: vi.fn(),
    waitForLoadState: vi.fn(),
    waitForSelector,
  }
  const context = {
    close: vi.fn(),
    newPage: vi.fn(async () => page),
  }
  const browser = {
    close: vi.fn(),
    newContext: vi.fn(async () => context),
  }

  return {
    browser,
    context,
    page,
  }
}

describe('renderCarmodooNativeImagesWithBrowser', () => {
  it('loads the proxied Carmodoo page and screenshots each page_wrap as JPG', async () => {
    const firstElement = {
      screenshot: vi.fn(async () => Buffer.from([1, 2, 3])),
    }
    const secondElement = {
      screenshot: vi.fn(async () => Buffer.from([4, 5])),
    }
    const page = {
      $$: vi.fn(async () => [firstElement, secondElement]),
      addStyleTag: vi.fn(),
      close: vi.fn(),
      goto: vi.fn(),
      setViewportSize: vi.fn(),
      waitForLoadState: vi.fn(),
      waitForSelector: vi.fn(),
    }
    const context = {
      close: vi.fn(),
      newPage: vi.fn(async () => page),
    }
    const browser = {
      newContext: vi.fn(async () => context),
    }

    const images = await renderCarmodooNativeImagesWithBrowser(
      browser,
      carmodooUrl,
      {
        origin: 'http://localhost',
        timeoutMs: 15_000,
      }
    )

    expect(images).toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])])
    expect(browser.newContext).toHaveBeenCalledWith({
      deviceScaleFactor: 2,
      locale: 'ko-KR',
      viewport: CARMODOO_RENDER_VIEWPORT,
    })
    expect(page.goto).toHaveBeenCalledWith(
      `http://localhost/api/v2/checkpaper?url=${encodeURIComponent(carmodooUrl)}`,
      {
        timeout: expect.any(Number),
        waitUntil: 'networkidle',
      }
    )
    expect(page.goto.mock.calls[0]?.[1]?.timeout).toBeLessThanOrEqual(15_000)
    expect(page.waitForSelector).toHaveBeenCalledWith(
      '.repaircheck_box .page_wrap',
      {
        state: 'attached',
        timeout: 15_000,
      }
    )
    expect(firstElement.screenshot).toHaveBeenCalledWith({
      quality: 92,
      timeout: expect.any(Number),
      type: 'jpeg',
    })
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('normalizes trusted origin before building the proxied Carmodoo URL', async () => {
    const { browser, page } = createRendererBrowser()

    await renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
      origin: 'http://localhost/foo',
      timeoutMs: 15_000,
    })

    expect(page.goto).toHaveBeenCalledWith(
      `http://localhost/api/v2/checkpaper?url=${encodeURIComponent(carmodooUrl)}`,
      expect.any(Object)
    )
  })

  it('uses a shared timeout budget across Playwright waits', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)

    try {
      const { browser, page } = createRendererBrowser({
        goto: vi.fn(async () => {
          vi.setSystemTime(1_040)
        }),
      })

      await renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost',
        timeoutMs: 100,
      })

      expect(page.goto).toHaveBeenCalledWith(expect.any(String), {
        timeout: 100,
        waitUntil: 'networkidle',
      })
      expect(page.waitForLoadState).toHaveBeenCalledWith('networkidle', {
        timeout: 60,
      })
      expect(page.waitForSelector).toHaveBeenCalledWith(expect.any(String), {
        state: 'attached',
        timeout: 60,
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects external proxy origins before opening a browser context', async () => {
    const { browser } = createRendererBrowser()

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'https://evil.example',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('성능점검기록부 주소를 확인하지 못했습니다.')
    expect(browser.newContext).not.toHaveBeenCalled()
  })

  it('accepts localhost origins outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined)
    const { browser } = createRendererBrowser()

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost:3000',
        timeoutMs: 15_000,
      })
    ).resolves.toEqual([new Uint8Array([1, 2, 3])])
  })

  it('rejects localhost origins in production without a matching app URL', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', undefined)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://truck.example')
    const { browser } = createRendererBrowser()

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost:3000',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('성능점검기록부 주소를 확인하지 못했습니다.')
    expect(browser.newContext).not.toHaveBeenCalled()
  })

  it('accepts the configured app URL origin in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', undefined)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://truck.example/app')
    const { browser, page } = createRendererBrowser()

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'https://truck.example/request-path',
        timeoutMs: 15_000,
      })
    ).resolves.toEqual([new Uint8Array([1, 2, 3])])
    expect(page.goto).toHaveBeenCalledWith(
      `https://truck.example/api/v2/checkpaper?url=${encodeURIComponent(carmodooUrl)}`,
      expect.any(Object)
    )
  })

  it('rejects zero rendered sheets and still cleans up the browser context', async () => {
    const { browser, context } = createRendererBrowser({
      elements: [],
    })

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://127.0.0.1:3000',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('성능점검기록부 페이지를 찾지 못했습니다.')
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('rejects too many rendered sheets and still cleans up the browser context', async () => {
    const { browser, context } = createRendererBrowser({
      elements: Array.from({ length: 5 }, () => ({
        screenshot: vi.fn(async () => Buffer.from([1])),
      })),
    })

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost:3000',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('성능점검기록부 페이지를 찾지 못했습니다.')
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('rejects zero-byte screenshots and still cleans up the browser context', async () => {
    const { browser, context } = createRendererBrowser({
      elements: [
        {
          screenshot: vi.fn(async () => Buffer.from([])),
        },
      ],
    })

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost:3000',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('성능점검기록부 이미지를 만들지 못했습니다.')
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('cleans up the browser context when navigation fails', async () => {
    const { browser, context } = createRendererBrowser({
      goto: vi.fn(async () => {
        throw new Error('goto failed')
      }),
    })

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('goto failed')
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('cleans up the browser context when waiting for sheets fails', async () => {
    const { browser, context } = createRendererBrowser({
      waitForSelector: vi.fn(async () => {
        throw new Error('selector failed')
      }),
    })

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('selector failed')
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('cleans up the browser context when screenshotting fails', async () => {
    const context = {
      close: vi.fn(),
      newPage: vi.fn(async () => ({
        $$: vi.fn(async () => [
          {
            screenshot: vi.fn(async () => {
              throw new Error('screenshot failed')
            }),
          },
        ]),
        addStyleTag: vi.fn(),
        goto: vi.fn(),
        setViewportSize: vi.fn(),
        waitForLoadState: vi.fn(),
        waitForSelector: vi.fn(),
      })),
    }
    const browser = {
      newContext: vi.fn(async () => context),
    }

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('screenshot failed')
    expect(context.close).toHaveBeenCalledTimes(1)
  })
})

describe('renderCarmodooNativeImagesWithLauncher', () => {
  it('launches Chromium and closes the browser when rendering fails', async () => {
    const { browser } = createRendererBrowser({
      elements: [],
    })
    const launcher = {
      launch: vi.fn(async () => browser),
    }

    await expect(
      renderCarmodooNativeImagesWithLauncher(launcher, carmodooUrl, {
        origin: 'http://localhost',
      })
    ).rejects.toThrow('성능점검기록부 페이지를 찾지 못했습니다.')

    expect(launcher.launch).toHaveBeenCalledWith({
      headless: true,
    })
    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('starts the default render budget before launching Chromium', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)

    const { browser, page } = createRendererBrowser()
    const launcher = {
      launch: vi.fn(async () => {
        vi.setSystemTime(4_000)
        return browser
      }),
    }

    await renderCarmodooNativeImagesWithLauncher(launcher, carmodooUrl, {
      origin: 'http://localhost',
    })

    expect(page.goto.mock.calls[0]?.[1]?.timeout).toBe(9_000)
  })
})
