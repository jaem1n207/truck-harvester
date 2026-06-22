import html2canvas from 'html2canvas'

const DEFAULT_PROXY_PATH = '/api/v2/checkpaper'
const DEFAULT_JPEG_QUALITY = 0.92
const DEFAULT_IFRAME_WIDTH = 1200
const DEFAULT_IFRAME_HEIGHT = 1800

export type PerformanceCheckPageRenderer = (
  page: HTMLElement
) => Promise<HTMLCanvasElement>

export interface CapturePerformanceCheckImagesOptions {
  document?: Document
  jpegQuality?: number
  proxyPath?: string
  renderPage?: PerformanceCheckPageRenderer
  signal?: AbortSignal
}

function createAbortError() {
  return new DOMException('다운로드가 취소되었습니다.', 'AbortError')
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

function waitForFrameDocument(iframe: HTMLIFrameElement, signal?: AbortSignal) {
  const frameDocumentPromise = new Promise<Document>((resolve, reject) => {
    const cleanup = () => {
      iframe.removeEventListener('load', handleLoad)
      iframe.removeEventListener('error', handleError)
    }

    const handleLoad = () => {
      cleanup()

      if (!iframe.contentDocument) {
        reject(new Error('성능점검기록부 문서를 불러오지 못했습니다.'))
        return
      }

      resolve(iframe.contentDocument)
    }

    const handleError = () => {
      cleanup()
      reject(new Error('성능점검기록부를 불러오지 못했습니다.'))
    }

    iframe.addEventListener('load', handleLoad, { once: true })
    iframe.addEventListener('error', handleError, { once: true })
  })

  return withAbort(frameDocumentPromise, signal)
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('성능점검기록부 이미지를 만들지 못했습니다.'))
          return
        }

        resolve(new Uint8Array(await blob.arrayBuffer()))
      },
      'image/jpeg',
      quality
    )
  })
}

const renderPageWithHtml2Canvas: PerformanceCheckPageRenderer = (page) =>
  html2canvas(page, {
    backgroundColor: '#ffffff',
    scale: Math.max(1, Math.min(window.devicePixelRatio || 1, 2)),
  })

export async function capturePerformanceCheckImages(
  performanceCheckUrl?: string | null,
  {
    document: injectedDocument,
    jpegQuality = DEFAULT_JPEG_QUALITY,
    proxyPath = DEFAULT_PROXY_PATH,
    renderPage = renderPageWithHtml2Canvas,
    signal,
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

  const iframe = createCaptureFrame(
    ownerDocument,
    buildProxiedCheckPaperUrl(trimmedUrl, proxyPath)
  )

  try {
    const frameDocument = await waitForFrameDocument(iframe, signal)
    assertNotAborted(signal)

    const pages = Array.from(
      frameDocument.querySelectorAll<HTMLElement>('.page')
    )

    if (pages.length === 0) {
      return []
    }

    const images: Uint8Array[] = []

    for (const page of pages) {
      assertNotAborted(signal)

      const canvas = await withAbort(renderPage(page), signal)
      assertNotAborted(signal)

      images.push(
        await withAbort(canvasToJpegBytes(canvas, jpegQuality), signal)
      )
    }

    return images
  } finally {
    iframe.remove()
  }
}
