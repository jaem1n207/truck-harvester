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
    KeyboardEvent: {
      configurable: true,
      value: dom.window.KeyboardEvent,
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
    expect(html).toContain('aria-labelledby="tour-overlay-addresses-title"')
    expect(html).toContain(
      'aria-describedby="tour-overlay-addresses-description"'
    )
    expect(html).toContain(tourSteps[0].title)
    expect(html).toContain(tourSteps[0].description)
    expect(html).toContain('id="tour-overlay-addresses-title"')
    expect(html).toContain('id="tour-overlay-addresses-description"')
    expect(html).toContain('이전')
    expect(html).toContain('다음')
    expect(html).toContain('그만 보기')
    expect(html).toContain('data-tour-dim="top"')
    expect(html).toContain('data-tour-highlight="true"')
    expect(html).toContain('data-motion="tour-highlight"')
    expect(html).toContain('data-motion="tour-card"')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('pointer-events-none fixed inset-0')
    expect(html).toContain('data-tour-card="true"')
    expect(html).toContain('max-h-[calc(100dvh-32px)]')
    expect(html).toContain('overflow-y-auto')
  })

  it('renders the current step example card inside the dialog', () => {
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

    expect(html).toContain('주소창 전체 복사')
    expect(html).toContain('덤프 메가트럭 4.5톤')
    expect(html).toContain('DetailView.asp?...처럼 앞부분이 빠진 주소')
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

  it('uses left and right arrow keys for tour navigation', async () => {
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

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ArrowLeft',
        })
      )
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ArrowRight',
        })
      )
    })

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('does not move before the first step when ArrowLeft is pressed', async () => {
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

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ArrowLeft',
        })
      )
    })

    expect(onPrevious).not.toHaveBeenCalled()
  })

  it('lets ArrowRight on the last step use the same next handler as finish', async () => {
    const onNext = vi.fn()

    installDom()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <TourOverlay
          currentStep={tourSteps.length - 1}
          isOpen
          onClose={vi.fn()}
          onNext={onNext}
          onPrevious={vi.fn()}
          steps={tourSteps}
        />
      )
    })

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')

    expect(container.textContent).toContain('마치기')

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ArrowRight',
        })
      )
    })

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('keeps arrow keys available for text editing inside editable controls', async () => {
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

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    const textarea = document.createElement('textarea')
    dialog?.append(textarea)

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ArrowRight',
        })
      )
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'ArrowLeft',
        })
      )
    })

    expect(onNext).not.toHaveBeenCalled()
    expect(onPrevious).not.toHaveBeenCalled()
  })

  it('moves focus into the dialog, traps Tab, closes on Escape, and restores focus', async () => {
    const onClose = vi.fn()

    installDom()
    const backgroundButton = document.createElement('button')
    backgroundButton.textContent = '배경 버튼'
    document.body.append(backgroundButton)
    backgroundButton.focus()

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        <TourOverlay
          currentStep={1}
          isOpen
          onClose={onClose}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          steps={tourSteps}
        />
      )
    })

    const closeButton = container.querySelector<HTMLButtonElement>(
      'button[data-tour-control="close"]'
    )
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[data-tour-control="next"]'
    )
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')

    expect(document.activeElement).toBe(closeButton)

    nextButton?.focus()
    await act(async () => {
      nextButton?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Tab',
        })
      )
    })

    expect(document.activeElement).toBe(closeButton)

    closeButton?.focus()
    await act(async () => {
      closeButton?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Tab',
          shiftKey: true,
        })
      )
    })

    expect(document.activeElement).toBe(nextButton)

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Escape',
        })
      )
    })

    expect(onClose).toHaveBeenCalledTimes(1)

    await act(async () => {
      root?.unmount()
    })

    root = null
    expect(document.activeElement).toBe(backgroundButton)
  })
})
