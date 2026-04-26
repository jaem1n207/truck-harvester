import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import V2Page from '../page'

const listingPreparationMocks = vi.hoisted(() => ({
  prepareListingUrls: vi.fn(),
}))

vi.mock('@/v2/features/listing-preparation', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/v2/features/listing-preparation')>()

  return {
    ...actual,
    prepareListingUrls: listingPreparationMocks.prepareListingUrls,
  }
})

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

const validTruckUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'
const secondTruckUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }

  container?.remove()
  root = null
  container = null
  vi.clearAllMocks()
})

describe('V2Page', () => {
  it('provides a stable fallback anchor for onboarding', () => {
    const html = renderToStaticMarkup(<V2Page />)

    expect(html).toContain('data-tour="v2-page"')
  })

  it('renders the operational v2 flow instead of the placeholder preview', () => {
    const html = renderToStaticMarkup(<V2Page />)

    expect(html).toContain('매물 주소 넣기')
    expect(html).toContain('복사한 내용을 그대로 붙여넣으세요')
    expect(html).toContain('오늘 작업')
    expect(html).toContain('압축 파일로 저장됩니다')
    expect(html).toContain('도움말')
    expect(html).not.toContain('가져올 매물')
    expect(html).not.toContain('truck-1')
  })

  it('keeps overlapping listing previews active until leaving the route', async () => {
    listingPreparationMocks.prepareListingUrls.mockReturnValue(
      new Promise(() => {})
    )

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<V2Page />)
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    expect(textarea).toBeInstanceOf(HTMLTextAreaElement)

    const pasteText = async (text: string) => {
      const pasteEvent = new Event('paste', {
        bubbles: true,
        cancelable: true,
      })

      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: () => text,
        },
      })

      await act(async () => {
        textarea?.dispatchEvent(pasteEvent)
      })
    }

    await pasteText(validTruckUrl)

    expect(listingPreparationMocks.prepareListingUrls).toHaveBeenCalledTimes(1)

    const [firstInput] =
      listingPreparationMocks.prepareListingUrls.mock.calls[0]

    expect(firstInput.signal).toBeInstanceOf(AbortSignal)
    expect(firstInput.signal.aborted).toBe(false)

    await pasteText(secondTruckUrl)

    expect(listingPreparationMocks.prepareListingUrls).toHaveBeenCalledTimes(2)

    const [secondInput] =
      listingPreparationMocks.prepareListingUrls.mock.calls[1]

    expect(secondInput.signal).toBeInstanceOf(AbortSignal)
    expect(firstInput.signal.aborted).toBe(false)
    expect(secondInput.signal.aborted).toBe(false)

    await act(async () => {
      root?.unmount()
      root = null
    })

    expect(firstInput.signal.aborted).toBe(true)
    expect(secondInput.signal.aborted).toBe(true)
  })

  it('keeps the latest duplicate warning when an older preview resolves later', async () => {
    const previewResolvers: Array<
      (result: { added: string[]; duplicates: string[] }) => void
    > = []
    const previewPromises: Array<
      Promise<{ added: string[]; duplicates: string[] }>
    > = []

    listingPreparationMocks.prepareListingUrls.mockImplementation(() => {
      const previewPromise = new Promise<{
        added: string[]
        duplicates: string[]
      }>((resolve) => {
        previewResolvers.push(resolve)
      })

      previewPromises.push(previewPromise)
      return previewPromise
    })

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<V2Page />)
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    expect(textarea).toBeInstanceOf(HTMLTextAreaElement)

    const pasteText = async (text: string) => {
      const pasteEvent = new Event('paste', {
        bubbles: true,
        cancelable: true,
      })

      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: () => text,
        },
      })

      await act(async () => {
        textarea?.dispatchEvent(pasteEvent)
      })
    }

    await pasteText(validTruckUrl)
    await pasteText(secondTruckUrl)

    expect(previewResolvers).toHaveLength(2)
    expect(listingPreparationMocks.prepareListingUrls).toHaveBeenCalledTimes(2)

    await act(async () => {
      previewResolvers[1]?.({ added: [], duplicates: [secondTruckUrl] })
      await previewPromises[1]
      await Promise.resolve()
    })

    expect(container.textContent).toContain('이미 넣은 매물이에요.')

    await act(async () => {
      previewResolvers[0]?.({ added: [validTruckUrl], duplicates: [] })
      await previewPromises[0]
      await Promise.resolve()
    })

    expect(container.textContent).toContain('이미 넣은 매물이에요.')
  })
})
