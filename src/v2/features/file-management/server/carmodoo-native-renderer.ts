import { CARMODOO_RENDER_MAX_PAGE_COUNT } from '@/v2/shared/lib/carmodoo-performance-check'

export const CARMODOO_RENDER_VIEWPORT = {
  height: 1020,
  width: 1440,
}

const DEFAULT_CARMODOO_RENDER_TIMEOUT_MS = 15_000
const CARMODOO_RENDER_SCALE = 2
const CARMODOO_RENDER_JPEG_QUALITY = 92

type ScreenshotElement = {
  screenshot: (options: { quality: number; type: 'jpeg' }) => Promise<Buffer>
}

type RendererPage = {
  $$: (selector: string) => Promise<ScreenshotElement[]>
  addStyleTag: (options: { content: string }) => Promise<unknown>
  goto: (
    url: string,
    options: { timeout: number; waitUntil: 'networkidle' }
  ) => Promise<unknown>
  setViewportSize: (
    viewport: typeof CARMODOO_RENDER_VIEWPORT
  ) => Promise<unknown>
  waitForLoadState: (
    state: 'networkidle',
    options: { timeout: number }
  ) => Promise<unknown>
  waitForSelector: (
    selector: string,
    options: { state: 'attached'; timeout: number }
  ) => Promise<unknown>
}

type RendererContext = {
  close: () => Promise<unknown>
  newPage: () => Promise<RendererPage>
}

type RendererBrowser = {
  newContext: (options: {
    deviceScaleFactor: number
    locale: string
    viewport: typeof CARMODOO_RENDER_VIEWPORT
  }) => Promise<RendererContext>
}

function buildProxiedCarmodooUrl(sourceUrl: string, origin: string) {
  return `${origin}/api/v2/checkpaper?url=${encodeURIComponent(sourceUrl)}`
}

function getCarmodooNativeStyle() {
  return `
    body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .repaircheck_box {
      background: #fff !important;
      color: #000 !important;
      font-family: Dotum, 돋움, Arial, sans-serif !important;
      margin: 0 !important;
      width: 1400px !important;
    }
    .repaircheck_box .btn_box {
      display: none !important;
    }
    .repaircheck_box .page_wrap {
      background: #fff !important;
      display: block !important;
      height: 950px !important;
      overflow: hidden !important;
      page-break-after: always !important;
      width: 1400px !important;
    }
  `
}

export async function renderCarmodooNativeImagesWithBrowser(
  browser: RendererBrowser,
  sourceUrl: string,
  {
    origin,
    timeoutMs = DEFAULT_CARMODOO_RENDER_TIMEOUT_MS,
  }: {
    origin: string
    timeoutMs?: number
  }
) {
  const context = await browser.newContext({
    deviceScaleFactor: CARMODOO_RENDER_SCALE,
    locale: 'ko-KR',
    viewport: CARMODOO_RENDER_VIEWPORT,
  })

  try {
    const page = await context.newPage()

    await page.setViewportSize(CARMODOO_RENDER_VIEWPORT)
    await page.goto(buildProxiedCarmodooUrl(sourceUrl, origin), {
      timeout: timeoutMs,
      waitUntil: 'networkidle',
    })
    await page.addStyleTag({ content: getCarmodooNativeStyle() })
    await page.waitForLoadState('networkidle', { timeout: timeoutMs })
    await page.waitForSelector('.repaircheck_box .page_wrap', {
      state: 'attached',
      timeout: timeoutMs,
    })

    const sheets = await page.$$('.repaircheck_box .page_wrap')

    if (sheets.length === 0 || sheets.length > CARMODOO_RENDER_MAX_PAGE_COUNT) {
      throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
    }

    const images: Uint8Array[] = []

    for (const sheet of sheets) {
      const buffer = await sheet.screenshot({
        quality: CARMODOO_RENDER_JPEG_QUALITY,
        type: 'jpeg',
      })
      images.push(new Uint8Array(buffer))
    }

    return images
  } finally {
    await context.close()
  }
}

export async function renderCarmodooNativeImages(
  sourceUrl: string,
  options: { origin: string }
) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
  })

  try {
    return await renderCarmodooNativeImagesWithBrowser(
      browser,
      sourceUrl,
      options
    )
  } finally {
    await browser.close()
  }
}
