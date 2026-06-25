import { CARMODOO_RENDER_MAX_PAGE_COUNT } from '@/v2/shared/lib/carmodoo-performance-check'

export const CARMODOO_RENDER_VIEWPORT = {
  height: 1020,
  width: 1440,
}

const DEFAULT_CARMODOO_RENDER_TIMEOUT_MS = 45_000
const CARMODOO_RENDER_SCALE = 2
const CARMODOO_RENDER_JPEG_QUALITY = 92
const CARMODOO_RENDER_TIMEOUT_MESSAGE =
  '성능점검기록부 이미지를 만드는 시간이 초과되었습니다.'
const CARMODOO_RENDER_INVALID_ORIGIN_MESSAGE =
  '성능점검기록부 주소를 확인하지 못했습니다.'

type ScreenshotElement = {
  screenshot: (options: {
    quality: number
    timeout: number
    type: 'jpeg'
  }) => Promise<Buffer>
}

type RendererPage = {
  $$: (selector: string) => Promise<ScreenshotElement[]>
  addStyleTag: (options: { content: string }) => Promise<unknown>
  emulateMedia: (options: { media: 'print' }) => Promise<unknown>
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

type LaunchedRendererBrowser = RendererBrowser & {
  close: () => Promise<unknown>
}

type RendererLauncher = {
  launch: (options: RendererLaunchOptions) => Promise<LaunchedRendererBrowser>
}

type RendererLaunchOptions = {
  args?: string[]
  executablePath?: string
  headless: true
  timeout: number
}

type ServerlessChromium = {
  args: string[]
  executablePath: () => Promise<string>
  setGraphicsMode?: boolean
}

type ServerlessChromiumLoader = () => Promise<{
  default: ServerlessChromium
}>

function createRenderTimeoutBudget(totalMs: number) {
  const deadlineMs = Date.now() + totalMs

  return {
    getRemainingMs() {
      const remainingMs = deadlineMs - Date.now()

      if (remainingMs <= 0) {
        throw new Error(CARMODOO_RENDER_TIMEOUT_MESSAGE)
      }

      return remainingMs
    },
  }
}

export type RenderTimeoutBudget = ReturnType<typeof createRenderTimeoutBudget>

export async function withRenderTimeout<T>(
  promise: Promise<T>,
  timeoutBudget: RenderTimeoutBudget
) {
  const timeoutMs = timeoutBudget.getRemainingMs()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(CARMODOO_RENDER_TIMEOUT_MESSAGE))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

function getAllowedProductionOrigin() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (!appUrl) {
    return undefined
  }

  try {
    return new URL(appUrl).origin
  } catch {
    return undefined
  }
}

function isLocalOrigin(url: URL) {
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  )
}

function assertTrustedRenderOrigin(origin: string) {
  let parsedOrigin: URL

  try {
    parsedOrigin = new URL(origin)
  } catch {
    throw new Error(CARMODOO_RENDER_INVALID_ORIGIN_MESSAGE)
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const isLocalRenderOrigin = isLocalOrigin(parsedOrigin)
  const productionOrigin = getAllowedProductionOrigin()
  const isProductionOrigin =
    productionOrigin !== undefined && parsedOrigin.origin === productionOrigin
  const isProductionRequestOrigin =
    isProduction &&
    productionOrigin === undefined &&
    (parsedOrigin.protocol === 'https:' || isLocalRenderOrigin)

  if (
    !isProductionOrigin &&
    !isProductionRequestOrigin &&
    (isProduction || !isLocalRenderOrigin)
  ) {
    throw new Error(CARMODOO_RENDER_INVALID_ORIGIN_MESSAGE)
  }

  return parsedOrigin.origin
}

function shouldUseServerlessChromium() {
  return process.env.VERCEL === '1'
}

export async function createCarmodooRendererLaunchOptions(
  timeoutBudget: RenderTimeoutBudget,
  loadServerlessChromium: ServerlessChromiumLoader = () =>
    import('@sparticuz/chromium')
): Promise<RendererLaunchOptions> {
  const launchOptions: Omit<RendererLaunchOptions, 'timeout'> = {
    headless: true,
  }

  if (shouldUseServerlessChromium()) {
    const { default: chromium } = await withRenderTimeout(
      loadServerlessChromium(),
      timeoutBudget
    )

    chromium.setGraphicsMode = false
    launchOptions.args = chromium.args
    launchOptions.executablePath = await withRenderTimeout(
      chromium.executablePath(),
      timeoutBudget
    )
  }

  return {
    ...launchOptions,
    timeout: timeoutBudget.getRemainingMs(),
  }
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
    timeoutBudget,
    timeoutMs = DEFAULT_CARMODOO_RENDER_TIMEOUT_MS,
  }: {
    origin: string
    timeoutBudget?: RenderTimeoutBudget
    timeoutMs?: number
  }
) {
  assertTrustedRenderOrigin(origin)
  const renderTimeoutBudget =
    timeoutBudget ?? createRenderTimeoutBudget(timeoutMs)

  renderTimeoutBudget.getRemainingMs()
  const context = await browser.newContext({
    deviceScaleFactor: CARMODOO_RENDER_SCALE,
    locale: 'ko-KR',
    viewport: CARMODOO_RENDER_VIEWPORT,
  })

  try {
    renderTimeoutBudget.getRemainingMs()
    const page = await context.newPage()

    renderTimeoutBudget.getRemainingMs()
    await page.setViewportSize(CARMODOO_RENDER_VIEWPORT)
    renderTimeoutBudget.getRemainingMs()
    await page.emulateMedia({ media: 'print' })
    renderTimeoutBudget.getRemainingMs()
    await page.goto(sourceUrl, {
      timeout: renderTimeoutBudget.getRemainingMs(),
      waitUntil: 'networkidle',
    })
    renderTimeoutBudget.getRemainingMs()
    await page.addStyleTag({ content: getCarmodooNativeStyle() })
    renderTimeoutBudget.getRemainingMs()
    await page.waitForLoadState('networkidle', {
      timeout: renderTimeoutBudget.getRemainingMs(),
    })
    await page.waitForSelector('.repaircheck_box .page_wrap', {
      state: 'attached',
      timeout: renderTimeoutBudget.getRemainingMs(),
    })

    renderTimeoutBudget.getRemainingMs()
    const sheets = await page.$$('.repaircheck_box .page_wrap')
    renderTimeoutBudget.getRemainingMs()

    if (sheets.length === 0 || sheets.length > CARMODOO_RENDER_MAX_PAGE_COUNT) {
      throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
    }

    const images: Uint8Array[] = []

    for (const sheet of sheets) {
      const buffer = await sheet.screenshot({
        quality: CARMODOO_RENDER_JPEG_QUALITY,
        timeout: renderTimeoutBudget.getRemainingMs(),
        type: 'jpeg',
      })
      renderTimeoutBudget.getRemainingMs()

      if (buffer.byteLength === 0) {
        throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
      }

      images.push(new Uint8Array(buffer))
    }

    return images
  } finally {
    await context.close()
  }
}

export async function renderCarmodooNativeImagesWithLauncher(
  launcher: RendererLauncher,
  sourceUrl: string,
  {
    loadServerlessChromium,
    origin,
    timeoutBudget,
    timeoutMs = DEFAULT_CARMODOO_RENDER_TIMEOUT_MS,
  }: {
    loadServerlessChromium?: ServerlessChromiumLoader
    origin: string
    timeoutBudget?: RenderTimeoutBudget
    timeoutMs?: number
  }
) {
  const renderTimeoutBudget =
    timeoutBudget ?? createRenderTimeoutBudget(timeoutMs)
  renderTimeoutBudget.getRemainingMs()
  const browser = await launcher.launch(
    await createCarmodooRendererLaunchOptions(
      renderTimeoutBudget,
      loadServerlessChromium
    )
  )

  try {
    renderTimeoutBudget.getRemainingMs()
    return await renderCarmodooNativeImagesWithBrowser(browser, sourceUrl, {
      origin,
      timeoutBudget: renderTimeoutBudget,
    })
  } finally {
    await browser.close()
  }
}

export async function renderCarmodooNativeImagesWithPlaywrightImport(
  loadPlaywright: () => Promise<{ chromium: RendererLauncher }>,
  sourceUrl: string,
  {
    origin,
    timeoutMs = DEFAULT_CARMODOO_RENDER_TIMEOUT_MS,
  }: { origin: string; timeoutMs?: number }
) {
  const timeoutBudget = createRenderTimeoutBudget(timeoutMs)
  const { chromium } = await withRenderTimeout(loadPlaywright(), timeoutBudget)

  return renderCarmodooNativeImagesWithLauncher(chromium, sourceUrl, {
    origin,
    timeoutBudget,
  })
}

export async function renderCarmodooNativeImages(
  sourceUrl: string,
  options: { origin: string }
) {
  return renderCarmodooNativeImagesWithPlaywrightImport(
    () => import('playwright'),
    sourceUrl,
    options
  )
}
