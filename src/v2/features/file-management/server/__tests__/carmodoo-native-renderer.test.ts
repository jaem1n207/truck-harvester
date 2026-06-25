import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CARMODOO_RENDER_VIEWPORT,
  createCarmodooRendererLaunchOptions,
  renderCarmodooNativeImagesWithBrowser,
  renderCarmodooNativeImagesWithLauncher,
  renderCarmodooNativeImagesWithPlaywrightImport,
  withRenderTimeout,
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
    emulateMedia: vi.fn(),
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
  it('loads the Carmodoo page directly and screenshots each page_wrap as JPG', async () => {
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
      emulateMedia: vi.fn(),
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
    expect(page.goto).toHaveBeenCalledWith(carmodooUrl, {
      timeout: expect.any(Number),
      waitUntil: 'networkidle',
    })
    expect(page.emulateMedia).toHaveBeenCalledWith({ media: 'print' })
    expect(page.goto.mock.calls[0]?.[1]?.timeout).toBeLessThanOrEqual(15_000)
    expect(page.waitForSelector).toHaveBeenCalledWith(
      '.repaircheck_box .page_wrap',
      {
        state: 'attached',
        timeout: expect.any(Number),
      }
    )
    expect(
      page.waitForSelector.mock.calls[0]?.[1]?.timeout
    ).toBeLessThanOrEqual(15_000)
    expect(firstElement.screenshot).toHaveBeenCalledWith({
      quality: 92,
      timeout: expect.any(Number),
      type: 'jpeg',
    })
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('validates trusted origin without using it as the page navigation target', async () => {
    const { browser, page } = createRendererBrowser()

    await renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
      origin: 'http://localhost/foo',
      timeoutMs: 15_000,
    })

    expect(page.goto).toHaveBeenCalledWith(carmodooUrl, expect.any(Object))
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

  it('accepts localhost origins in production when no app URL is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', undefined)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined)
    const { browser } = createRendererBrowser()

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost:3000',
        timeoutMs: 15_000,
      })
    ).resolves.toEqual([new Uint8Array([1, 2, 3])])
  })

  it('accepts HTTPS request origins in production when no app URL is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', undefined)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined)
    const { browser, page } = createRendererBrowser()

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'https://preview.example/request-path',
        timeoutMs: 15_000,
      })
    ).resolves.toEqual([new Uint8Array([1, 2, 3])])
    expect(page.goto).toHaveBeenCalledWith(carmodooUrl, expect.any(Object))
  })

  it('rejects non-local HTTP request origins in production when no app URL is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', undefined)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined)
    const { browser } = createRendererBrowser()

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://preview.example',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('성능점검기록부 주소를 확인하지 못했습니다.')
    expect(browser.newContext).not.toHaveBeenCalled()
  })

  it('rejects localhost origins in production even when Vitest is set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'true')
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
    expect(page.goto).toHaveBeenCalledWith(carmodooUrl, expect.any(Object))
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
        emulateMedia: vi.fn(),
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
      timeout: expect.any(Number),
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

    expect(launcher.launch).toHaveBeenCalledWith({
      headless: true,
      timeout: 45_000,
    })
    expect(page.goto.mock.calls[0]?.[1]?.timeout).toBe(42_000)
  })
})

describe('renderCarmodooNativeImagesWithPlaywrightImport', () => {
  it('starts the default render budget before importing Playwright and launching Chromium', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)

    const { browser, page } = createRendererBrowser()
    const launcher = {
      launch: vi.fn(async () => {
        vi.setSystemTime(4_000)
        return browser
      }),
    }
    const loadPlaywright = vi.fn(async () => {
      vi.setSystemTime(3_000)

      return {
        chromium: launcher,
      }
    })

    await renderCarmodooNativeImagesWithPlaywrightImport(
      loadPlaywright,
      carmodooUrl,
      {
        origin: 'http://localhost',
      }
    )

    expect(launcher.launch).toHaveBeenCalledWith({
      headless: true,
      timeout: 43_000,
    })
    expect(page.goto.mock.calls[0]?.[1]?.timeout).toBe(42_000)
  })
})

describe('createCarmodooRendererLaunchOptions', () => {
  it('uses the default Playwright executable outside Vercel', async () => {
    vi.stubEnv('VERCEL', undefined)
    const loadServerlessChromium = vi.fn()

    await expect(
      createCarmodooRendererLaunchOptions(
        {
          getRemainingMs: () => 15_000,
        },
        loadServerlessChromium
      )
    ).resolves.toEqual({
      headless: true,
      timeout: 15_000,
    })
    expect(loadServerlessChromium).not.toHaveBeenCalled()
  })

  it('uses the serverless Chromium executable on Vercel', async () => {
    vi.stubEnv('VERCEL', '1')

    const chromium = {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      executablePath: vi.fn(async () => '/tmp/chromium'),
      setGraphicsMode: true,
    }
    const loadServerlessChromium = vi.fn(async () => ({
      default: chromium,
    }))

    await expect(
      createCarmodooRendererLaunchOptions(
        {
          getRemainingMs: () => 15_000,
        },
        loadServerlessChromium
      )
    ).resolves.toEqual({
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      executablePath: '/tmp/chromium',
      headless: true,
      timeout: 15_000,
    })
    expect(loadServerlessChromium).toHaveBeenCalledTimes(1)
    expect(chromium.executablePath).toHaveBeenCalledTimes(1)
    expect(chromium.setGraphicsMode).toBe(false)
  })
})

describe('withRenderTimeout', () => {
  it('rejects when the shared render budget is exhausted', async () => {
    await expect(
      withRenderTimeout(Promise.resolve('late'), {
        getRemainingMs() {
          throw new Error(
            '성능점검기록부 이미지를 만드는 시간이 초과되었습니다.'
          )
        },
      })
    ).rejects.toThrow('성능점검기록부 이미지를 만드는 시간이 초과되었습니다.')
  })
})
