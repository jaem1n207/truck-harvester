import { createRequire } from 'node:module'

import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { tourSteps } from '../../lib/tour-steps'
import { TourOverlay } from '../tour-overlay'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom') as {
  JSDOM: new (
    html: string,
    options: { url: string }
  ) => {
    window: Window & typeof globalThis
  }
}

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null
let dom: { window: Window & typeof globalThis } | null = null

const installDom = () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/v2',
  })

  Object.defineProperties(globalThis, {
    document: {
      configurable: true,
      value: dom.window.document,
    },
    HTMLElement: {
      configurable: true,
      value: dom.window.HTMLElement,
    },
    window: {
      configurable: true,
      value: dom.window,
    },
  })
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }

  container?.remove()
  root = null
  container = null
  dom?.window.close()
  dom = null
})

describe('TourOverlay', () => {
  it('renders the current step with spotlight layers in an accessible Korean dialog', () => {
    const html = renderToStaticMarkup(
      <TourOverlay
        currentStep={0}
        isOpen
        onClose={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        steps={tourSteps}
      />
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain(tourSteps[0].title)
    expect(html).toContain(tourSteps[0].description)
    expect(html).toContain('이전')
    expect(html).toContain('다음')
    expect(html).toContain('그만 보기')
    expect(html).toContain('data-tour-dim="top"')
    expect(html).toContain('data-tour-highlight="true"')
    expect(html).toContain('data-motion="tour-highlight"')
    expect(html).toContain('data-motion="tour-card"')
    expect(html).toContain('disabled=""')
  })

  it('keeps the previous control disabled on the first step', async () => {
    const onPrevious = vi.fn()

    installDom()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <TourOverlay
          currentStep={0}
          isOpen
          onClose={vi.fn()}
          onNext={vi.fn()}
          onPrevious={onPrevious}
          steps={tourSteps}
        />
      )
    })

    const previousButton = container.querySelector<HTMLButtonElement>(
      'button[data-tour-control="previous"]'
    )

    expect(previousButton?.disabled).toBe(true)

    await act(async () => {
      previousButton?.click()
    })

    expect(onPrevious).not.toHaveBeenCalled()
  })

  it('calls the previous and next handlers after the first step', async () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()

    installDom()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <TourOverlay
          currentStep={1}
          isOpen
          onClose={vi.fn()}
          onNext={onNext}
          onPrevious={onPrevious}
          steps={tourSteps}
        />
      )
    })

    const previousButton = container.querySelector<HTMLButtonElement>(
      'button[data-tour-control="previous"]'
    )
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[data-tour-control="next"]'
    )

    expect(previousButton?.disabled).toBe(false)

    await act(async () => {
      previousButton?.click()
      nextButton?.click()
    })

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
