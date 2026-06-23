import { describe, expect, it, vi } from 'vitest'

import {
  CARMODOO_RENDER_VIEWPORT,
  renderCarmodooNativeImagesWithBrowser,
} from '../carmodoo-native-renderer'

const carmodooUrl =
  'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

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
        timeout: 15_000,
        waitUntil: 'networkidle',
      }
    )
    expect(page.waitForSelector).toHaveBeenCalledWith(
      '.repaircheck_box .page_wrap',
      {
        state: 'attached',
        timeout: 15_000,
      }
    )
    expect(firstElement.screenshot).toHaveBeenCalledWith({
      quality: 92,
      type: 'jpeg',
    })
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
