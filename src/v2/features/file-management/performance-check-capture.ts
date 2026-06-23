import html2canvas from 'html2canvas'

import {
  decodeCarmodooNativeRenderResponse,
  isCarmodooPrintUrl,
} from '@/v2/shared/lib/carmodoo-performance-check'

const DEFAULT_PROXY_PATH = '/api/v2/checkpaper'
const DEFAULT_ASSET_PROXY_PATH = '/api/v2/checkpaper/asset'
const DEFAULT_JPEG_QUALITY = 0.92
const DEFAULT_IFRAME_WIDTH = 1200
const DEFAULT_IFRAME_HEIGHT = 1800
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_PDF_RENDER_SCALE = 2
const CARMODOO_CHECKBOX_ICON_URL =
  'https://ck.carmodoo.com/images/input_checkbox.png'
const CARMODOO_PRINT_SHEET_WIDTH = 1440
const CARMODOO_PRINT_SHEET_HEIGHT = 1020
const CARMODOO_PRINT_CONTENT_WIDTH = 1400
const CARMODOO_PRINT_CONTENT_HEIGHT = 950
const CARMODOO_PRINT_CONTENT_LEFT = 45
const CARMODOO_PRINT_CONTENT_TOP = 66
const CARMODOO_PRINT_CONTENT_SCALE = 0.964
const CARMODOO_PRINT_HEADER_TOP = 26
const CARMODOO_PRINT_FOOTER_TOP = 984
const CARMODOO_PRINT_BROWSER_TEXT_LEFT = 45
const CARMODOO_PRINT_BROWSER_TEXT_RIGHT = 45
const CARMODOO_PRINT_BROWSER_TEXT_SIZE = 12

export type PerformanceCheckPageRenderer = (
  page: HTMLElement
) => Promise<HTMLCanvasElement>

export type PerformanceCheckPdfFetcher = (
  proxiedPdfUrl: string,
  options: { signal?: AbortSignal }
) => Promise<Uint8Array>

export type PerformanceCheckPdfRenderer = (
  pdfBytes: Uint8Array,
  options: {
    document: Document
    signal?: AbortSignal
    timeoutMs: number
  }
) => Promise<HTMLCanvasElement[]>

export type PerformanceCheckPrintableUrlResolver = (
  sourceUrl: string,
  options: {
    proxyPath: string
    signal?: AbortSignal
  }
) => Promise<string | undefined>

export type PerformanceCheckNativeRenderer = (
  sourceUrl: string,
  options: { signal?: AbortSignal; timeoutMs: number }
) => Promise<Uint8Array[]>

export interface CapturePerformanceCheckImagesOptions {
  assetProxyPath?: string
  document?: Document
  fetchPdf?: PerformanceCheckPdfFetcher
  jpegQuality?: number
  preferPrintablePdf?: boolean
  proxyPath?: string
  renderCarmodooNativeImages?: PerformanceCheckNativeRenderer
  resolvePrintableUrl?: PerformanceCheckPrintableUrlResolver
  renderPdfPages?: PerformanceCheckPdfRenderer
  renderPage?: PerformanceCheckPageRenderer
  signal?: AbortSignal
  timeoutMs?: number
}

type CaptureContext = {
  assetProxyPath: string
  fetchPdf: PerformanceCheckPdfFetcher
  jpegQuality: number
  ownerDocument: Document
  proxyPath: string
  renderCarmodooNativeImages: PerformanceCheckNativeRenderer
  renderPage: PerformanceCheckPageRenderer
  renderPdfPages: PerformanceCheckPdfRenderer
  signal?: AbortSignal
  timeoutMs: number
}

type PerformanceCheckCaptureProvider = {
  id: 'checkpaper-pdf' | 'carmodoo-native'
  canHandle: (url: URL) => boolean
  capture: (url: URL, context: CaptureContext) => Promise<Uint8Array[]>
}

function createAbortError() {
  return new DOMException('다운로드가 취소되었습니다.', 'AbortError')
}

function createLoadTimeoutError() {
  return new Error('성능점검기록부를 불러오는 시간이 초과되었습니다.')
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function buildProxiedCheckPaperUrl(url: string, proxyPath: string) {
  const separator = proxyPath.includes('?') ? '&' : '?'

  return `${proxyPath}${separator}url=${encodeURIComponent(url)}`
}

function deriveCheckPaperPrintableRecordUrl(value: string) {
  try {
    const url = new URL(value)
    const checkId = url.searchParams.get('check_id')?.trim()

    if (checkId) {
      return new URL(
        `/view/record.do?check_id=${checkId}`,
        url.origin
      ).toString()
    }

    const checkNo = url.searchParams.get('checkNo')?.trim()

    if (!checkNo || !/^\d{10}$/.test(checkNo)) {
      return undefined
    }

    const printableCheckId = `${checkNo.slice(0, 2)}-${checkNo.slice(
      2,
      4
    )}-${checkNo.slice(4)}`

    return new URL(
      `/view/record.do?check_id=${printableCheckId}`,
      url.origin
    ).toString()
  } catch {
    return undefined
  }
}

function parsePerformanceCheckUrl(value: string) {
  try {
    const url = new URL(value)

    if (!/^https?:$/i.test(url.protocol)) {
      return undefined
    }

    return url
  } catch {
    return undefined
  }
}

function normalizeCarmodooNativeRenderUrl(url: URL) {
  const normalizedUrl = new URL(url.toString())

  normalizedUrl.protocol = 'https:'

  return normalizedUrl.toString()
}

function createCaptureFrame(ownerDocument: Document, src: string) {
  const iframe = ownerDocument.createElement('iframe')

  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.src = src
  Object.assign(iframe.style, {
    border: '0',
    height: `${DEFAULT_IFRAME_HEIGHT}px`,
    left: '-10000px',
    pointerEvents: 'none',
    position: 'absolute',
    top: '0',
    width: `${DEFAULT_IFRAME_WIDTH}px`,
  })

  ownerDocument.body.appendChild(iframe)

  return iframe
}

function withAbort<T>(work: Promise<T>, signal?: AbortSignal) {
  if (!signal) {
    return work
  }

  assertNotAborted(signal)

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortError())
    }

    signal.addEventListener('abort', onAbort, { once: true })
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort)
    })
  })
}

function withImageTimeout<T>(work: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
      settleError(
        new Error('성능점검기록부 이미지를 만드는 시간이 초과되었습니다.')
      )
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(timeoutId)
    }

    const settle = (value: T) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve(value)
    }

    const settleError = (error: unknown) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      reject(error)
    }

    work.then(settle, settleError)
  })
}

function waitForFrameDocument({
  iframe,
  signal,
  timeoutMs,
}: {
  iframe: HTMLIFrameElement
  signal?: AbortSignal
  timeoutMs: number
}) {
  return new Promise<Document>((resolve, reject) => {
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      iframe.removeEventListener('load', handleLoad)
      iframe.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
    }

    const settle = (callback: (value: Document) => void, value: Document) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      callback(value)
    }

    const settleError = (error: unknown) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      reject(error)
    }

    const handleLoad = () => {
      if (!iframe.contentDocument) {
        settleError(new Error('성능점검기록부 문서를 불러오지 못했습니다.'))
        return
      }

      settle(resolve, iframe.contentDocument)
    }

    const handleError = () => {
      settleError(new Error('성능점검기록부를 불러오지 못했습니다.'))
    }

    const handleAbort = () => {
      settleError(createAbortError())
    }

    iframe.addEventListener('load', handleLoad, { once: true })
    iframe.addEventListener('error', handleError, { once: true })
    signal?.addEventListener('abort', handleAbort, { once: true })

    timeoutId = setTimeout(() => {
      settleError(new Error('성능점검기록부를 불러오는 시간이 초과되었습니다.'))
    }, timeoutMs)

    if (signal?.aborted) {
      handleAbort()
    }
  })
}

function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number,
  timeoutMs: number
) {
  return new Promise<Uint8Array>((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
      settleError(
        new Error('성능점검기록부 이미지를 만드는 시간이 초과되었습니다.')
      )
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(timeoutId)
    }

    const settle = (value: Uint8Array) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve(value)
    }

    const settleError = (error: unknown) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      reject(error)
    }

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            settleError(new Error('성능점검기록부 이미지를 만들지 못했습니다.'))
            return
          }

          blob.arrayBuffer().then(
            (buffer) => settle(new Uint8Array(buffer)),
            (error: unknown) => settleError(error)
          )
        },
        'image/jpeg',
        quality
      )
    } catch (error) {
      settleError(error)
    }
  })
}

function getPageRenderScale() {
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
}

const renderPageWithHtml2Canvas: PerformanceCheckPageRenderer = (page) =>
  html2canvas(page, {
    backgroundColor: '#ffffff',
    scale: getPageRenderScale(),
  })

function escapeCssString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function extractBaseHref(html: string) {
  if (typeof DOMParser === 'undefined') {
    return undefined
  }

  const parsedDocument = new DOMParser().parseFromString(html, 'text/html')
  const href = parsedDocument.querySelector('base[href]')?.getAttribute('href')

  return href?.trim() || undefined
}

const resolvePrintableUrlFromProxy: PerformanceCheckPrintableUrlResolver =
  async (sourceUrl, { proxyPath, signal }) => {
    const response = await fetch(
      buildProxiedCheckPaperUrl(sourceUrl, proxyPath),
      {
        signal,
      }
    )

    if (!response.ok) {
      return undefined
    }

    const finalUrl = response.headers.get('x-checkpaper-final-url')?.trim()
    if (finalUrl) {
      return finalUrl
    }

    return extractBaseHref(await response.text())
  }

function configurePdfWorker(
  pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs')
) {
  if (
    pdfjs.GlobalWorkerOptions.workerSrc &&
    pdfjs.GlobalWorkerOptions.workerSrc !== './pdf.worker.mjs'
  ) {
    return
  }

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString()
}

const fetchPdfBytes: PerformanceCheckPdfFetcher = async (
  proxiedPdfUrl,
  { signal }
) => {
  const response = await fetch(proxiedPdfUrl, { signal })

  if (!response.ok) {
    throw new Error('성능점검기록부 인쇄본을 불러오지 못했습니다.')
  }

  const contentType = response.headers.get('content-type')
  if (
    contentType &&
    !contentType.includes('application/pdf') &&
    !contentType.includes('application/octet-stream')
  ) {
    throw new Error('성능점검기록부 인쇄본 형식이 올바르지 않습니다.')
  }

  return new Uint8Array(await response.arrayBuffer())
}

const renderCarmodooNativeImagesViaApi: PerformanceCheckNativeRenderer = async (
  sourceUrl,
  { signal, timeoutMs }
) => {
  assertNotAborted(signal)

  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)
  const handleExternalAbort = () => {
    controller.abort()
  }

  signal?.addEventListener('abort', handleExternalAbort, { once: true })

  try {
    const response = await fetch('/api/v2/checkpaper/carmodoo-render', {
      body: JSON.stringify({ url: sourceUrl }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error('성능점검기록부를 불러오지 못했습니다.')
    }

    return decodeCarmodooNativeRenderResponse(await response.json())
  } catch (error) {
    if (didTimeout) {
      throw createLoadTimeoutError()
    }

    if (signal?.aborted) {
      throw createAbortError()
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', handleExternalAbort)
  }
}

const renderPdfPagesWithPdfJs: PerformanceCheckPdfRenderer = async (
  pdfBytes,
  { document: ownerDocument, signal }
) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  configurePdfWorker(pdfjs)
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
  })
  const pdf = await withAbort(loadingTask.promise, signal)

  try {
    const canvases: HTMLCanvasElement[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      assertNotAborted(signal)

      const page = await withAbort(pdf.getPage(pageNumber), signal)
      const viewport = page.getViewport({ scale: DEFAULT_PDF_RENDER_SCALE })
      const canvas = ownerDocument.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('성능점검기록부 이미지를 만들 수 없습니다.')
      }

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      })

      await withAbort(renderTask.promise, signal)
      page.cleanup()
      canvases.push(canvas)
    }

    return canvases
  } finally {
    await loadingTask.destroy()
  }
}

async function capturePrintablePdfImages({
  assetProxyPath,
  fetchPdf,
  jpegQuality,
  ownerDocument,
  printableRecordUrl,
  renderPdfPages,
  signal,
  timeoutMs,
}: {
  assetProxyPath: string
  fetchPdf: PerformanceCheckPdfFetcher
  jpegQuality: number
  ownerDocument: Document
  printableRecordUrl: string
  renderPdfPages: PerformanceCheckPdfRenderer
  signal?: AbortSignal
  timeoutMs: number
}) {
  const proxiedPdfUrl = buildProxiedCheckPaperUrl(
    printableRecordUrl,
    assetProxyPath
  )
  const pdfBytes = await withAbort(fetchPdf(proxiedPdfUrl, { signal }), signal)
  assertNotAborted(signal)

  const canvases = await withAbort(
    withImageTimeout(
      renderPdfPages(pdfBytes, {
        document: ownerDocument,
        signal,
        timeoutMs,
      }),
      timeoutMs
    ),
    signal
  )

  if (canvases.length === 0) {
    throw new Error('성능점검기록부 인쇄본 페이지를 찾지 못했습니다.')
  }

  const images: Uint8Array[] = []

  for (const canvas of canvases) {
    assertNotAborted(signal)
    images.push(
      await withAbort(canvasToJpegBytes(canvas, jpegQuality, timeoutMs), signal)
    )
  }

  return images
}

async function captureHtmlPageImages({
  jpegQuality,
  ownerDocument,
  pageSelector = '.page',
  prepareFrameDocument,
  proxyPath,
  renderPage,
  signal,
  timeoutMs,
  url,
}: {
  jpegQuality: number
  ownerDocument: Document
  pageSelector?: string
  prepareFrameDocument?: (frameDocument: Document) => void
  proxyPath: string
  renderPage: PerformanceCheckPageRenderer
  signal?: AbortSignal
  timeoutMs: number
  url: string
}) {
  const iframe = createCaptureFrame(
    ownerDocument,
    buildProxiedCheckPaperUrl(url, proxyPath)
  )

  try {
    const frameDocument = await waitForFrameDocument({
      iframe,
      signal,
      timeoutMs,
    })
    assertNotAborted(signal)
    prepareFrameDocument?.(frameDocument)

    const pages = Array.from(
      frameDocument.querySelectorAll<HTMLElement>(pageSelector)
    )

    if (pages.length === 0) {
      throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
    }

    const images: Uint8Array[] = []

    for (const page of pages) {
      assertNotAborted(signal)

      const canvas = await withAbort(
        withImageTimeout(renderPage(page), timeoutMs),
        signal
      )
      assertNotAborted(signal)

      images.push(
        await withAbort(
          canvasToJpegBytes(canvas, jpegQuality, timeoutMs),
          signal
        )
      )
    }

    return images
  } finally {
    iframe.remove()
  }
}

function restoreStyleProperty(
  element: HTMLElement,
  property: string,
  value: string,
  priority: string
) {
  if (value) {
    element.style.setProperty(property, value, priority)
    return
  }

  element.style.removeProperty(property)
}

function drawCarmodooPrintBrowserText(
  context: CanvasRenderingContext2D,
  sheet: HTMLElement
) {
  const header = sheet.querySelector<HTMLElement>(
    '.carmodoo-print-browser-header'
  )
  const footer = sheet.querySelector<HTMLElement>(
    '.carmodoo-print-browser-footer'
  )
  const headerDate = header?.children.item(0)?.textContent ?? ''
  const headerTitle = header?.children.item(1)?.textContent ?? ''
  const footerUrl = footer?.children.item(0)?.textContent ?? ''
  const footerPage = footer?.children.item(1)?.textContent ?? ''
  const rightEdge =
    CARMODOO_PRINT_SHEET_WIDTH - CARMODOO_PRINT_BROWSER_TEXT_RIGHT

  context.fillStyle = '#000'
  context.font = `${CARMODOO_PRINT_BROWSER_TEXT_SIZE}px Dotum, Arial, sans-serif`
  context.textBaseline = 'top'
  context.fillText(
    headerDate,
    CARMODOO_PRINT_BROWSER_TEXT_LEFT,
    CARMODOO_PRINT_HEADER_TOP
  )
  context.fillText(
    headerTitle,
    CARMODOO_PRINT_SHEET_WIDTH / 2 - context.measureText(headerTitle).width / 2,
    CARMODOO_PRINT_HEADER_TOP
  )
  context.fillText(
    footerUrl,
    CARMODOO_PRINT_BROWSER_TEXT_LEFT,
    CARMODOO_PRINT_FOOTER_TOP
  )
  context.fillText(
    footerPage,
    rightEdge - context.measureText(footerPage).width,
    CARMODOO_PRINT_FOOTER_TOP
  )
}

async function renderCarmodooPrintSheet({
  renderContent,
  sheet,
}: {
  renderContent: PerformanceCheckPageRenderer
  sheet: HTMLElement
}) {
  const ownerDocument = sheet.ownerDocument
  const canvas = ownerDocument.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('성능점검기록부 이미지를 만들 수 없습니다.')
  }

  const renderScale = getPageRenderScale()
  canvas.width = Math.ceil(CARMODOO_PRINT_SHEET_WIDTH * renderScale)
  canvas.height = Math.ceil(CARMODOO_PRINT_SHEET_HEIGHT * renderScale)

  const content = sheet.querySelector<HTMLElement>('.carmodoo-print-content')
  const pageWrap = sheet.querySelector<HTMLElement>('.page_wrap')

  if (!content || !pageWrap) {
    throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
  }

  const previousTransform = content.style.getPropertyValue('transform')
  const previousTransformPriority =
    content.style.getPropertyPriority('transform')

  content.style.setProperty('transform', 'none', 'important')

  try {
    const contentCanvas = await renderContent(pageWrap)

    context.save()
    context.scale(renderScale, renderScale)
    context.fillStyle = '#ffffff'
    context.fillRect(
      0,
      0,
      CARMODOO_PRINT_SHEET_WIDTH,
      CARMODOO_PRINT_SHEET_HEIGHT
    )
    context.drawImage(
      contentCanvas,
      CARMODOO_PRINT_CONTENT_LEFT,
      CARMODOO_PRINT_CONTENT_TOP,
      CARMODOO_PRINT_CONTENT_WIDTH * CARMODOO_PRINT_CONTENT_SCALE,
      CARMODOO_PRINT_CONTENT_HEIGHT * CARMODOO_PRINT_CONTENT_SCALE
    )
    drawCarmodooPrintBrowserText(context, sheet)
    context.restore()

    return canvas
  } finally {
    restoreStyleProperty(
      content,
      'transform',
      previousTransform,
      previousTransformPriority
    )
  }
}

async function captureCarmodooHtmlImages({
  assetProxyPath,
  jpegQuality,
  ownerDocument,
  proxyPath,
  renderPage,
  signal,
  timeoutMs,
  url,
}: {
  assetProxyPath: string
  jpegQuality: number
  ownerDocument: Document
  proxyPath: string
  renderPage: PerformanceCheckPageRenderer
  signal?: AbortSignal
  timeoutMs: number
  url: string
}) {
  const iframe = createCaptureFrame(
    ownerDocument,
    buildProxiedCheckPaperUrl(url, proxyPath)
  )

  try {
    const frameDocument = await waitForFrameDocument({
      iframe,
      signal,
      timeoutMs,
    })
    assertNotAborted(signal)
    prepareCarmodooFrameDocument(frameDocument, assetProxyPath, url)

    const sheets = Array.from(
      frameDocument.querySelectorAll<HTMLElement>(
        '[data-performance-check-sheet="carmodoo"]'
      )
    )

    if (sheets.length === 0) {
      throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
    }

    const images: Uint8Array[] = []

    for (const sheet of sheets) {
      assertNotAborted(signal)

      const canvas = await withAbort(
        withImageTimeout(
          renderCarmodooPrintSheet({
            renderContent: renderPage,
            sheet,
          }),
          timeoutMs
        ),
        signal
      )
      assertNotAborted(signal)

      images.push(
        await withAbort(
          canvasToJpegBytes(canvas, jpegQuality, timeoutMs),
          signal
        )
      )
    }

    return images
  } finally {
    iframe.remove()
  }
}

function replaceCarmodooCheckboxes(frameDocument: Document) {
  frameDocument
    .querySelectorAll<HTMLInputElement>(
      '.repaircheck_box input[type="checkbox"]'
    )
    .forEach((input) => {
      const checkbox = frameDocument.createElement('span')
      checkbox.dataset.performanceCheckCheckbox = 'carmodoo'
      checkbox.dataset.checked =
        input.checked || input.hasAttribute('checked') ? 'true' : 'false'
      checkbox.setAttribute('aria-hidden', 'true')
      input.replaceWith(checkbox)
    })
}

function formatCarmodooPrintDate(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const period = hours < 12 ? '오전' : '오후'
  const hour = hours % 12 || 12
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}. ${month}. ${day}. ${period} ${hour}:${minute}`
}

function createCarmodooPrintSheets(frameDocument: Document, sourceUrl: string) {
  if (
    frameDocument.querySelector('[data-performance-check-sheets="carmodoo"]')
  ) {
    return
  }

  const pageWraps = Array.from(
    frameDocument.querySelectorAll<HTMLElement>('.repaircheck_box .page_wrap')
  )

  if (pageWraps.length === 0) {
    return
  }

  const sheetList = frameDocument.createElement('div')
  sheetList.dataset.performanceCheckSheets = 'carmodoo'
  const title = frameDocument.title.trim()
  const capturedAt = formatCarmodooPrintDate()

  pageWraps.forEach((pageWrap, index) => {
    const sheet = frameDocument.createElement('section')
    sheet.dataset.performanceCheckSheet = 'carmodoo'

    const header = frameDocument.createElement('div')
    header.className = 'carmodoo-print-browser-header'

    const headerDate = frameDocument.createElement('span')
    headerDate.textContent = capturedAt
    const headerTitle = frameDocument.createElement('span')
    headerTitle.textContent = title
    const headerSpacer = frameDocument.createElement('span')
    header.append(headerDate, headerTitle, headerSpacer)

    const content = frameDocument.createElement('div')
    content.className = 'carmodoo-print-content repaircheck_box'
    content.append(pageWrap)

    const footer = frameDocument.createElement('div')
    footer.className = 'carmodoo-print-browser-footer'

    const footerUrl = frameDocument.createElement('span')
    footerUrl.textContent = sourceUrl
    const footerPage = frameDocument.createElement('span')
    footerPage.textContent = `${index + 1}/${pageWraps.length}`
    footer.append(footerUrl, footerPage)

    sheet.append(header, content, footer)
    sheetList.append(sheet)
  })

  frameDocument.body.append(sheetList)
}

function injectCarmodooPrintLayout(
  frameDocument: Document,
  checkboxIconUrl: string
) {
  if (
    frameDocument.querySelector(
      'style[data-performance-check-provider="carmodoo-html"]'
    )
  ) {
    return
  }

  const style = frameDocument.createElement('style')
  style.dataset.performanceCheckProvider = 'carmodoo-html'
  const escapedCheckboxIconUrl = escapeCssString(checkboxIconUrl)
  style.textContent = `
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .repaircheck_box {
      margin: 0 !important;
      width: 1400px !important;
    }
    [data-performance-check-sheets='carmodoo'] {
      background: #fff !important;
      color: #000 !important;
      display: block !important;
      font-family: Dotum, 돋움, Arial, sans-serif !important;
      margin: 0 !important;
      padding: 0 !important;
      width: ${CARMODOO_PRINT_SHEET_WIDTH}px !important;
    }
    [data-performance-check-sheet='carmodoo'] {
      background: #fff !important;
      box-sizing: border-box !important;
      color: #000 !important;
      display: block !important;
      height: ${CARMODOO_PRINT_SHEET_HEIGHT}px !important;
      margin: 0 !important;
      overflow: hidden !important;
      padding: 0 !important;
      position: relative !important;
      width: ${CARMODOO_PRINT_SHEET_WIDTH}px !important;
    }
    .carmodoo-print-browser-header,
    .carmodoo-print-browser-footer {
      box-sizing: border-box !important;
      color: #000 !important;
      display: grid !important;
      font-family: Dotum, 돋움, Arial, sans-serif !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      left: 45px !important;
      letter-spacing: 0 !important;
      line-height: 1.2 !important;
      position: absolute !important;
      right: 45px !important;
      z-index: 2 !important;
    }
    .carmodoo-print-browser-header {
      grid-template-columns: 1fr auto 1fr !important;
      top: 26px !important;
    }
    .carmodoo-print-browser-header span:nth-child(2) {
      text-align: center !important;
    }
    .carmodoo-print-browser-footer {
      bottom: 22px !important;
      grid-template-columns: 1fr auto !important;
    }
    .carmodoo-print-browser-footer span:first-child {
      overflow: hidden !important;
      padding-right: 20px !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    .carmodoo-print-content.repaircheck_box {
      height: ${CARMODOO_PRINT_CONTENT_HEIGHT}px !important;
      left: 45px !important;
      margin: 0 !important;
      overflow: visible !important;
      position: absolute !important;
      top: 66px !important;
      transform: scale(${CARMODOO_PRINT_CONTENT_SCALE}) !important;
      transform-origin: top left !important;
      width: ${CARMODOO_PRINT_CONTENT_WIDTH}px !important;
    }
    .repaircheck_box input[type='checkbox'] {
      height: 8pt !important;
      line-height: 1 !important;
      margin-bottom: 0 !important;
      margin-right: 2px !important;
      width: 8pt !important;
    }
    .repaircheck_box [data-performance-check-checkbox='carmodoo'] {
      background: #fff !important;
      border: 1px solid #333 !important;
      border-radius: 0 !important;
      box-sizing: border-box !important;
      display: inline-block !important;
      height: 8pt !important;
      line-height: 1 !important;
      margin: 0 2px 0 0 !important;
      vertical-align: text-bottom !important;
      width: 8pt !important;
    }
    .repaircheck_box [data-performance-check-checkbox='carmodoo'][data-checked='true'] {
      background-image: url("${escapedCheckboxIconUrl}") !important;
      background-position: center center !important;
      background-repeat: no-repeat !important;
      background-size: auto 14px !important;
    }
    .repaircheck_box .btn_box {
      display: none !important;
    }
    .repaircheck_box .header {
      display: block !important;
      height: 11pt !important;
    }
    .repaircheck_box .page_wrap {
      clear: both;
      display: block;
      height: 950px;
      page-break-after: always;
      page-break-before: auto;
      width: 100%;
    }
    .repaircheck_box .page_col1 {
      float: left;
      width: 49%;
    }
    .repaircheck_box .page_col2 {
      float: right;
      width: 49%;
    }
    .repaircheck_box .fuc_normal {
      display: none !important;
    }
    .repaircheck_box .fuc_print {
      display: block !important;
    }
    .repaircheck_box h1 {
      background: none !important;
      color: #000 !important;
      font-size: 9pt !important;
      line-height: 1 !important;
      padding: 4px !important;
    }
    .repaircheck_box h1 strong {
      font-size: 12pt !important;
    }
    .repaircheck_box h1 strong + br {
      display: none !important;
    }
    .repaircheck_box h1 .txt_small {
      color: #333 !important;
      font-size: 7.5pt !important;
    }
    .repaircheck_box .repair_position {
      padding: 4.5pt 0 !important;
    }
    .repaircheck_box table thead th {
      font-size: 15px !important;
      line-height: 1 !important;
      padding: 3.5pt 0 !important;
      text-align: center !important;
    }
    .repaircheck_box table thead th span {
      font-size: 7pt !important;
      font-weight: normal !important;
      line-height: 1 !important;
    }
    .repaircheck_box table thead th strong {
      letter-spacing: -2px !important;
      line-height: 1 !important;
    }
    .repaircheck_box table thead th strong + br {
      display: none !important;
    }
    .repaircheck_box table thead th.border_box strong + br {
      display: inline-block !important;
    }
    .repaircheck_box table tbody th {
      box-sizing: border-box !important;
      font-size: 13px !important;
      font-weight: normal !important;
      letter-spacing: -2px !important;
      line-height: 1.1 !important;
      padding: 0 3px !important;
      word-break: normal !important;
      word-wrap: break-word !important;
    }
    .repaircheck_box table tbody th.full {
      padding: 3px !important;
    }
    .repaircheck_box table tbody th.th2 {
      font-size: 11px !important;
      padding: 2px 7px !important;
    }
    .repaircheck_box td {
      box-sizing: border-box !important;
      font-size: 14px !important;
      letter-spacing: -1px !important;
      line-height: 1.1 !important;
      padding: 1px 3px !important;
    }
    .repaircheck_box td.mark {
      font-size: 12px !important;
    }
    .repaircheck_box td label {
      line-height: 1 !important;
    }
    .repaircheck_box table.td_padd td {
      padding: 1px 3px !important;
    }
    .repaircheck_box table.td_padd tbody th {
      font-size: 14px !important;
      letter-spacing: -2px !important;
      padding: 0 3px !important;
    }
    .repaircheck_box td .km {
      font-size: 10pt !important;
    }
    .repaircheck_box table.height_set {
      height: 760px !important;
    }
    .repaircheck_box table.height_set tbody td {
      padding: 0 12px !important;
    }
    .repaircheck_box table.height_set2 {
      height: 753px !important;
    }
    .repaircheck_box table.height_set3 {
      height: 500px !important;
    }
    .repaircheck_box table.height_set4 {
      height: 333px !important;
    }
    .repaircheck_box td ol li {
      font-size: 8pt !important;
      line-height: 1.2 !important;
      padding-bottom: 2pt !important;
    }
    .repaircheck_box td li li {
      padding-bottom: 2pt !important;
    }
    .repaircheck_box .line_box {
      font-size: 7.5pt !important;
      margin-top: 0 !important;
      padding-bottom: 5pt !important;
    }
    .repaircheck_box .line_box .tit {
      font-size: 10pt !important;
      left: -1px !important;
      margin: 0 !important;
      padding: 3pt 10px !important;
      top: -1px !important;
    }
    .repaircheck_box td .title_end {
      display: inline-block !important;
      padding-bottom: 10px !important;
    }
    .repaircheck_box .name1 {
      display: inline-block !important;
      text-align: left !important;
      width: 200px !important;
    }
    .repaircheck_box .name2 {
      display: inline-block !important;
      position: relative !important;
      text-align: right !important;
      width: 240px !important;
    }
    .repaircheck_box .name2 div {
      right: -57px !important;
    }
    .repaircheck_box table.ex td {
      line-height: 1.1 !important;
      padding: 4pt 20px 4pt 35px !important;
    }
    .repaircheck_box td.title {
      font-size: 10pt !important;
    }
    .repaircheck_box table thead th.th_guide {
      font-size: 9pt !important;
      height: 17px !important;
    }
    .repaircheck_box td .ar {
      display: inline-block !important;
      text-align: right !important;
      width: 29% !important;
    }
  `

  frameDocument.head.appendChild(style)
}

function prepareCarmodooFrameDocument(
  frameDocument: Document,
  assetProxyPath: string,
  sourceUrl: string
) {
  injectCarmodooPrintLayout(
    frameDocument,
    buildProxiedCheckPaperUrl(CARMODOO_CHECKBOX_ICON_URL, assetProxyPath)
  )
  replaceCarmodooCheckboxes(frameDocument)
  createCarmodooPrintSheets(frameDocument, sourceUrl)
}

const checkpaperPdfProvider: PerformanceCheckCaptureProvider = {
  id: 'checkpaper-pdf',
  canHandle(url) {
    return Boolean(deriveCheckPaperPrintableRecordUrl(url.toString()))
  },
  capture(url, context) {
    const printableRecordUrl = deriveCheckPaperPrintableRecordUrl(
      url.toString()
    )

    if (!printableRecordUrl) {
      throw new Error('성능점검기록부 인쇄본 주소를 찾지 못했습니다.')
    }

    return capturePrintablePdfImages({
      assetProxyPath: context.assetProxyPath,
      fetchPdf: context.fetchPdf,
      jpegQuality: context.jpegQuality,
      ownerDocument: context.ownerDocument,
      printableRecordUrl,
      renderPdfPages: context.renderPdfPages,
      signal: context.signal,
      timeoutMs: context.timeoutMs,
    })
  },
}

const carmodooNativeProvider: PerformanceCheckCaptureProvider = {
  id: 'carmodoo-native',
  canHandle: isCarmodooPrintUrl,
  capture(url, context) {
    const renderUrl = normalizeCarmodooNativeRenderUrl(url)

    return withAbort(
      context.renderCarmodooNativeImages(renderUrl, {
        signal: context.signal,
        timeoutMs: context.timeoutMs,
      }),
      context.signal
    )
  },
}

const performanceCheckProviders = [
  checkpaperPdfProvider,
  carmodooNativeProvider,
] satisfies PerformanceCheckCaptureProvider[]

function findPerformanceCheckProvider(url: URL) {
  return performanceCheckProviders.find((provider) => provider.canHandle(url))
}

export async function capturePerformanceCheckImages(
  performanceCheckUrl?: string | null,
  {
    assetProxyPath = DEFAULT_ASSET_PROXY_PATH,
    document: injectedDocument,
    fetchPdf = fetchPdfBytes,
    jpegQuality = DEFAULT_JPEG_QUALITY,
    preferPrintablePdf = true,
    proxyPath = DEFAULT_PROXY_PATH,
    renderCarmodooNativeImages = renderCarmodooNativeImagesViaApi,
    resolvePrintableUrl = resolvePrintableUrlFromProxy,
    renderPdfPages = renderPdfPagesWithPdfJs,
    renderPage = renderPageWithHtml2Canvas,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: CapturePerformanceCheckImagesOptions = {}
) {
  const trimmedUrl = performanceCheckUrl?.trim()

  if (!trimmedUrl) {
    return []
  }

  assertNotAborted(signal)

  const ownerDocument =
    injectedDocument ?? (typeof document === 'undefined' ? undefined : document)

  if (!ownerDocument?.body) {
    throw new Error('브라우저에서만 성능점검기록부를 캡처할 수 있습니다.')
  }

  const captureContext: CaptureContext = {
    assetProxyPath,
    fetchPdf,
    jpegQuality,
    ownerDocument,
    proxyPath,
    renderCarmodooNativeImages,
    renderPage,
    renderPdfPages,
    signal,
    timeoutMs,
  }

  if (!preferPrintablePdf) {
    return captureHtmlPageImages({
      jpegQuality,
      ownerDocument,
      proxyPath,
      renderPage,
      signal,
      timeoutMs,
      url: trimmedUrl,
    })
  }

  const sourceUrl = parsePerformanceCheckUrl(trimmedUrl)
  const sourceProvider = sourceUrl
    ? findPerformanceCheckProvider(sourceUrl)
    : undefined

  if (sourceUrl && sourceProvider) {
    return sourceProvider.capture(sourceUrl, captureContext)
  }

  const resolvedUrl = await withAbort(
    resolvePrintableUrl(trimmedUrl, {
      proxyPath,
      signal,
    }),
    signal
  )
  const resolvedPerformanceCheckUrl = resolvedUrl
    ? parsePerformanceCheckUrl(resolvedUrl)
    : undefined
  const resolvedProvider = resolvedPerformanceCheckUrl
    ? findPerformanceCheckProvider(resolvedPerformanceCheckUrl)
    : undefined

  if (resolvedPerformanceCheckUrl && resolvedProvider) {
    return resolvedProvider.capture(resolvedPerformanceCheckUrl, captureContext)
  }

  throw new Error('성능점검기록부 인쇄본 주소를 찾지 못했습니다.')
}
