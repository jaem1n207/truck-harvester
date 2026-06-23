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
