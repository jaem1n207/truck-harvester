import { isValidElement, type ReactNode } from 'react'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'

import { DirectorySelector } from '../directory-selector'

interface ClickableProps {
  children?: ReactNode
  onClick?: () => Promise<void>
}

const findClickHandler = (node: ReactNode): (() => Promise<void>) => {
  if (!isValidElement<ClickableProps>(node)) {
    throw new Error('clickable button was not found')
  }

  if (typeof node.props.onClick === 'function') {
    return node.props.onClick as () => Promise<void>
  }

  const children = node.props.children as ReactNode
  const childNodes = Array.isArray(children) ? children : [children]

  for (const child of childNodes) {
    try {
      return findClickHandler(child)
    } catch {
      // Continue through the rendered tree until the button element is found.
    }
  }

  throw new Error('clickable button was not found')
}

describe('DirectorySelector', () => {
  it('renders folder selection copy when the browser supports direct save', () => {
    const html = renderToStaticMarkup(
      <DirectorySelector isSupported onSelectDirectory={vi.fn()} />
    )

    expect(html).toContain(v2Copy.directorySelector.title)
    expect(html).toContain(v2Copy.directorySelector.choose)
    expect(html).toContain(v2Copy.directorySelector.explainer)
    expect(html).toContain('data-tour="directory-selector"')
  })

  it('renders zip fallback copy when direct save is unavailable', () => {
    const html = renderToStaticMarkup(
      <DirectorySelector isSupported={false} onSelectDirectory={vi.fn()} />
    )

    expect(html).toContain(v2Copy.directorySelector.unsupportedTitle)
    expect(html).toContain(v2Copy.directorySelector.unsupportedDescription)
  })

  it('treats a canceled folder picker as no selection', async () => {
    const originalPicker = window.showDirectoryPicker
    const onSelectDirectory = vi.fn()
    window.showDirectoryPicker = vi
      .fn()
      .mockRejectedValue(new DOMException('취소됨', 'AbortError'))

    const element = DirectorySelector({ isSupported: true, onSelectDirectory })
    const click = findClickHandler(element)

    await expect(click()).resolves.toBeUndefined()
    expect(onSelectDirectory).not.toHaveBeenCalled()

    window.showDirectoryPicker = originalPicker
  })
})
