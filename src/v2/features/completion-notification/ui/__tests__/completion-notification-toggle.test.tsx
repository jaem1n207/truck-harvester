import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompletionNotificationToggle } from '../completion-notification-toggle'

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

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
})

function renderToggle(
  props: Partial<React.ComponentProps<typeof CompletionNotificationToggle>> = {}
) {
  return (
    <CompletionNotificationToggle
      isAvailable
      onEnable={vi.fn()}
      permission="default"
      {...props}
    />
  )
}

describe('CompletionNotificationToggle', () => {
  it('renders optional notification copy without forcing permission', () => {
    const onEnable = vi.fn()
    const html = renderToStaticMarkup(renderToggle({ onEnable }))

    expect(html).toContain('완료 알림 켜기')
    expect(html).toContain('선택 사항')
    expect(onEnable).not.toHaveBeenCalled()
  })

  it('calls onEnable only when the enable button is clicked', () => {
    const onEnable = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    act(() => {
      root?.render(renderToggle({ onEnable }))
    })

    expect(onEnable).not.toHaveBeenCalled()

    const button = container.querySelector('button')

    expect(button).toBeInstanceOf(HTMLButtonElement)

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onEnable).toHaveBeenCalledTimes(1)
  })

  it('renders enabled copy after permission is granted', () => {
    const html = renderToStaticMarkup(renderToggle({ permission: 'granted' }))

    expect(html).toContain('완료 알림 켜짐')
  })

  it('renders denied copy in plain Korean', () => {
    const html = renderToStaticMarkup(renderToggle({ permission: 'denied' }))

    expect(html).toContain('브라우저 알림이 꺼져 있습니다')
  })

  it('renders nothing when unavailable or unsupported', () => {
    const unavailableHtml = renderToStaticMarkup(
      renderToggle({ isAvailable: false })
    )
    const unsupportedHtml = renderToStaticMarkup(
      renderToggle({ permission: 'unsupported' })
    )

    expect(unavailableHtml).toBe('')
    expect(unsupportedHtml).toBe('')
  })
})
