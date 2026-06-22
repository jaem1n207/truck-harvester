import html2canvas from 'html2canvas'

const DEFAULT_PROXY_PATH = '/api/v2/checkpaper'
const DEFAULT_JPEG_QUALITY = 0.92
const DEFAULT_IFRAME_WIDTH = 1200
const DEFAULT_IFRAME_HEIGHT = 1800
const DEFAULT_TIMEOUT_MS = 15_000

export type PerformanceCheckPageRenderer = (
  page: HTMLElement
) => Promise<HTMLCanvasElement>

export interface CapturePerformanceCheckImagesOptions {
  document?: Document
  jpegQuality?: number
  proxyPath?: string
  renderPage?: PerformanceCheckPageRenderer
  signal?: AbortSignal
  timeoutMs?: number
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

  const iframe = createCaptureFrame(
    ownerDocument,
    buildProxiedCheckPaperUrl(trimmedUrl, proxyPath)
  )

  try {
    const frameDocument = await waitForFrameDocument({
      iframe,
      signal,
      timeoutMs,
    })
    assertNotAborted(signal)

    const pages = Array.from(
      frameDocument.querySelectorAll<HTMLElement>('.page')
    )

    if (pages.length === 0) {
      throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
    }

    const images: Uint8Array[] = []

    for (const page of pages) {
      assertNotAborted(signal)

      const canvas = await withAbort(renderPage(page), signal)
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
