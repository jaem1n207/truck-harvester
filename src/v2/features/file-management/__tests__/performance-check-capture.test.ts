import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  capturePerformanceCheckImages,
  type CapturePerformanceCheckImagesOptions,
  type PerformanceCheckPageRenderer,
} from '../performance-check-capture'

const sourceUrl =
  'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107099659&print=0&iframe=1&key='
const printableSourceUrl =
  'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4100029368&print=0&iframe=1&key='
const printableRecordUrl =
  'https://checkpaper.jmenetworks.co.kr/view/record.do?check_id=41-00-029368'

function captureHtmlImages(options: CapturePerformanceCheckImagesOptions = {}) {
  return capturePerformanceCheckImages(sourceUrl, {
    preferPrintablePdf: false,
    ...options,
  })
}

function dispatchIframeLoad() {
  const iframe = document.querySelector('iframe')

  if (!iframe) {
    throw new Error('iframe was not created')
  }

  iframe.dispatchEvent(new Event('load'))

  return iframe
}

function addPagesToIframe(markup: string) {
  const iframe = document.querySelector('iframe')

  if (!iframe?.contentDocument) {
    throw new Error('iframe document was not created')
  }

  iframe.contentDocument.open()
  iframe.contentDocument.write(`<!doctype html><body>${markup}</body>`)
  iframe.contentDocument.close()
}

function createCanvas(bytes: number[]) {
  return {
    toBlob: vi.fn(
      (callback: BlobCallback, type?: string, quality?: number): undefined => {
        callback(new Blob([new Uint8Array(bytes)], { type }))
        expect(type).toBe('image/jpeg')
        expect(quality).toBe(0.92)
        return undefined
      }
    ),
  } as unknown as HTMLCanvasElement
}

function createCanvasWithRejectingBytes(error: Error) {
  return {
    toBlob: vi.fn((callback: BlobCallback): undefined => {
      callback({
        arrayBuffer: vi.fn(async () => {
          throw error
        }),
      } as unknown as Blob)

      return undefined
    }),
  } as unknown as HTMLCanvasElement
}

function createCanvasWithoutBlobCallback() {
  return {
    toBlob: vi.fn((): undefined => undefined),
  } as unknown as HTMLCanvasElement
}

function createCanvasWithThrowingToBlob(error: Error) {
  return {
    toBlob: vi.fn((): undefined => {
      throw error
    }),
  } as unknown as HTMLCanvasElement
}

describe('capturePerformanceCheckImages', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns an empty array when the performance check URL is missing', async () => {
    await expect(capturePerformanceCheckImages()).resolves.toEqual([])
    await expect(capturePerformanceCheckImages('   ')).resolves.toEqual([])
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('renders the printable record PDF as JPG byte arrays when a checkNo URL is provided', async () => {
    const firstCanvas = createCanvas([1, 2, 3])
    const secondCanvas = createCanvas([4, 5, 6])
    const pdfBytes = new Uint8Array([10, 11, 12])
    const fetchPdf = vi.fn(async () => pdfBytes)
    const renderPdfPages = vi.fn(async () => [firstCanvas, secondCanvas])

    await expect(
      capturePerformanceCheckImages(printableSourceUrl, {
        fetchPdf,
        renderPdfPages,
      })
    ).resolves.toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])])

    expect(fetchPdf).toHaveBeenCalledWith(
      `/api/v2/checkpaper/asset?url=${encodeURIComponent(printableRecordUrl)}`,
      { signal: undefined }
    )
    expect(renderPdfPages).toHaveBeenCalledWith(
      pdfBytes,
      expect.objectContaining({
        document,
        signal: undefined,
        timeoutMs: 15_000,
      })
    )
    expect(firstCanvas.toBlob).toHaveBeenCalledTimes(1)
    expect(secondCanvas.toBlob).toHaveBeenCalledTimes(1)
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('uses record.do URLs directly when the printable URL is already provided', async () => {
    const canvas = createCanvas([7])
    const fetchPdf = vi.fn(async () => new Uint8Array([20]))
    const renderPdfPages = vi.fn(async () => [canvas])

    await expect(
      capturePerformanceCheckImages(printableRecordUrl, {
        fetchPdf,
        renderPdfPages,
      })
    ).resolves.toEqual([new Uint8Array([7])])

    expect(fetchPdf).toHaveBeenCalledWith(
      `/api/v2/checkpaper/asset?url=${encodeURIComponent(printableRecordUrl)}`,
      { signal: undefined }
    )
  })

  it('rejects and cleans up when the proxied document has no page elements', async () => {
    const renderPage = vi.fn<PerformanceCheckPageRenderer>()
    const capturePromise = captureHtmlImages({
      renderPage,
    })

    const iframe = document.querySelector('iframe') as HTMLIFrameElement

    expect(iframe.getAttribute('src')).toBe(
      `/api/v2/checkpaper?url=${encodeURIComponent(sourceUrl)}`
    )

    addPagesToIframe('<main>점검 기록을 찾지 못했습니다.</main>')
    dispatchIframeLoad()

    await expect(capturePromise).rejects.toThrow(
      '성능점검기록부 페이지를 찾지 못했습니다.'
    )
    expect(renderPage).not.toHaveBeenCalled()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('captures multiple page elements as JPG byte arrays', async () => {
    const firstCanvas = createCanvas([1, 2, 3])
    const secondCanvas = createCanvas([4, 5, 6, 7])
    const renderPage = vi
      .fn<PerformanceCheckPageRenderer>()
      .mockResolvedValueOnce(firstCanvas)
      .mockResolvedValueOnce(secondCanvas)

    const capturePromise = captureHtmlImages({
      proxyPath: '/custom/checkpaper',
      renderPage,
    })

    const iframe = document.querySelector('iframe') as HTMLIFrameElement

    expect(iframe.getAttribute('src')).toBe(
      `/custom/checkpaper?url=${encodeURIComponent(sourceUrl)}`
    )

    addPagesToIframe(
      '<section class="page" id="first"></section><section class="page" id="second"></section>'
    )
    dispatchIframeLoad()

    await expect(capturePromise).resolves.toEqual([
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6, 7]),
    ])
    expect(renderPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'first' })
    )
    expect(renderPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'second' })
    )
    expect(firstCanvas.toBlob).toHaveBeenCalledTimes(1)
    expect(secondCanvas.toBlob).toHaveBeenCalledTimes(1)
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('rejects and cleans up the iframe when byte conversion fails', async () => {
    const conversionError = new Error('arrayBuffer failed')
    const renderPage = vi
      .fn<PerformanceCheckPageRenderer>()
      .mockResolvedValue(createCanvasWithRejectingBytes(conversionError))

    const capturePromise = captureHtmlImages({
      renderPage,
    })

    addPagesToIframe('<section class="page"></section>')
    dispatchIframeLoad()

    const result = await Promise.race([
      capturePromise.then(
        () => ({ status: 'resolved' as const }),
        (error: unknown) => ({ error, status: 'rejected' as const })
      ),
      new Promise<{ status: 'pending' }>((resolve) => {
        setTimeout(() => resolve({ status: 'pending' }), 20)
      }),
    ])

    expect(result).toEqual({
      error: conversionError,
      status: 'rejected',
    })
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('rejects and cleans up when iframe load times out', async () => {
    vi.useFakeTimers()

    const capturePromise = captureHtmlImages({
      renderPage: vi.fn<PerformanceCheckPageRenderer>(),
      timeoutMs: 50,
    })

    expect(document.querySelector('iframe')).toBeInstanceOf(HTMLIFrameElement)

    const rejection = expect(capturePromise).rejects.toThrow(
      '성능점검기록부를 불러오는 시간이 초과되었습니다.'
    )

    await vi.advanceTimersByTimeAsync(50)

    await rejection
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('rejects and cleans up when canvas blob conversion times out', async () => {
    vi.useFakeTimers()

    const renderPage = vi
      .fn<PerformanceCheckPageRenderer>()
      .mockResolvedValue(createCanvasWithoutBlobCallback())

    const capturePromise = captureHtmlImages({
      renderPage,
      timeoutMs: 50,
    })

    addPagesToIframe('<section class="page"></section>')
    dispatchIframeLoad()

    const rejection = expect(capturePromise).rejects.toThrow(
      '성능점검기록부 이미지를 만드는 시간이 초과되었습니다.'
    )

    await vi.advanceTimersByTimeAsync(50)

    await rejection
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('rejects and cleans up when rendering a page times out', async () => {
    vi.useFakeTimers()

    const renderPage = vi.fn<PerformanceCheckPageRenderer>(
      () => new Promise<HTMLCanvasElement>(() => undefined)
    )
    const capturePromise = captureHtmlImages({
      renderPage,
      timeoutMs: 50,
    })

    addPagesToIframe('<section class="page"></section>')
    dispatchIframeLoad()

    const rejection = expect(capturePromise).rejects.toThrow(
      '성능점검기록부 이미지를 만드는 시간이 초과되었습니다.'
    )

    await vi.advanceTimersByTimeAsync(50)

    await rejection
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('rejects with the original error and cleans up when canvas toBlob throws synchronously', async () => {
    vi.useFakeTimers()

    const toBlobError = new Error('toBlob failed')
    const renderPage = vi
      .fn<PerformanceCheckPageRenderer>()
      .mockResolvedValue(createCanvasWithThrowingToBlob(toBlobError))

    const capturePromise = captureHtmlImages({
      renderPage,
      timeoutMs: 50,
    })

    addPagesToIframe('<section class="page"></section>')
    dispatchIframeLoad()

    await expect(capturePromise).rejects.toBe(toBlobError)
    expect(document.querySelector('iframe')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(50)
    await expect(capturePromise).rejects.toBe(toBlobError)
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('throws AbortError without creating an iframe when already aborted', async () => {
    const controller = new AbortController()

    controller.abort()

    await expect(
      capturePerformanceCheckImages(sourceUrl, { signal: controller.signal })
    ).rejects.toMatchObject({
      name: 'AbortError',
      message: '다운로드가 취소되었습니다.',
    })
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('throws AbortError and cleans up when aborted during iframe load', async () => {
    const controller = new AbortController()
    const removeFrameListener = vi.spyOn(
      HTMLIFrameElement.prototype,
      'removeEventListener'
    )
    const removeAbortListener = vi.spyOn(
      controller.signal,
      'removeEventListener'
    )
    const capturePromise = captureHtmlImages({
      signal: controller.signal,
      renderPage: vi.fn<PerformanceCheckPageRenderer>(),
    })

    expect(document.querySelector('iframe')).toBeInstanceOf(HTMLIFrameElement)

    controller.abort()

    await expect(capturePromise).rejects.toMatchObject({
      name: 'AbortError',
      message: '다운로드가 취소되었습니다.',
    })
    expect(removeFrameListener).toHaveBeenCalledWith(
      'load',
      expect.any(Function)
    )
    expect(removeFrameListener).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    )
    expect(removeAbortListener).toHaveBeenCalledWith(
      'abort',
      expect.any(Function)
    )
    expect(document.querySelector('iframe')).toBeNull()
  })
})
