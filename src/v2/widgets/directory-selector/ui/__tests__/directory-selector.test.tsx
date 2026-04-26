import { isValidElement, type ReactNode } from 'react'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { type WritableDirectoryHandle } from '@/v2/features/file-management'
import { v2Copy } from '@/v2/shared/lib/copy'

import { DirectorySelector } from '../directory-selector'

interface ClickableProps {
  children?: ReactNode
  onClick?: () => Promise<void>
}

const browserGlobal = globalThis as typeof globalThis & {
  showDirectoryPicker?: unknown
  window?: typeof globalThis & { showDirectoryPicker?: unknown }
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

  it('shows the selected save folder with a folder icon hint', () => {
    const html = renderToStaticMarkup(
      <DirectorySelector
        isSupported
        onSelectDirectory={vi.fn()}
        selectedDirectoryName="고른 저장 폴더"
      />
    )

    expect(html).toContain('선택한 저장 폴더')
    expect(html).toContain('고른 저장 폴더')
    expect(html).toContain('data-selected-folder-icon="true"')
  })

  it('shows remembered folder permission guidance when permission needs confirmation', () => {
    const html = renderToStaticMarkup(
      <DirectorySelector
        isSupported
        onSelectDirectory={vi.fn()}
        permissionState="needs-permission"
        selectedDirectoryName="기억한 저장 폴더"
      />
    )

    expect(html).toContain('선택한 저장 폴더')
    expect(html).toContain('기억한 저장 폴더')
    expect(html).toContain('저장할 때 폴더 권한을 다시 확인합니다.')
  })

  it('passes the remembered folder to the picker start location', async () => {
    const originalWindow = browserGlobal.window
    const originalPicker = browserGlobal.showDirectoryPicker
    const rememberedDirectory = {
      name: '기억한 저장 폴더',
    } as WritableDirectoryHandle
    const pickedDirectory = {
      name: '새 저장 폴더',
    } as WritableDirectoryHandle
    const onSelectDirectory = vi.fn()

    const picker = vi.fn().mockResolvedValue(pickedDirectory)
    browserGlobal.showDirectoryPicker = picker
    Object.defineProperty(browserGlobal, 'window', {
      configurable: true,
      value: browserGlobal,
    })

    const element = DirectorySelector({
      isSupported: true,
      onSelectDirectory,
      pickerStartIn: rememberedDirectory,
    })
    const click = findClickHandler(element)

    await expect(click()).resolves.toBeUndefined()
    expect(picker).toHaveBeenCalledWith({
      id: 'truck-harvester-v2-save-folder',
      mode: 'readwrite',
      startIn: rememberedDirectory,
    })
    expect(onSelectDirectory).toHaveBeenCalledWith(pickedDirectory)

    browserGlobal.showDirectoryPicker = originalPicker
    Object.defineProperty(browserGlobal, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('renders zip fallback copy when direct save is unavailable', () => {
    const html = renderToStaticMarkup(
      <DirectorySelector isSupported={false} onSelectDirectory={vi.fn()} />
    )

    expect(html).toContain(v2Copy.directorySelector.unsupportedTitle)
    expect(html).toContain(v2Copy.directorySelector.unsupportedDescription)
  })

  it('treats a canceled folder picker as no selection', async () => {
    const originalWindow = browserGlobal.window
    const originalPicker = browserGlobal.showDirectoryPicker
    const onSelectDirectory = vi.fn()
    browserGlobal.showDirectoryPicker = vi
      .fn()
      .mockRejectedValue(new DOMException('취소됨', 'AbortError'))
    Object.defineProperty(browserGlobal, 'window', {
      configurable: true,
      value: browserGlobal,
    })

    const element = DirectorySelector({ isSupported: true, onSelectDirectory })
    const click = findClickHandler(element)

    await expect(click()).resolves.toBeUndefined()
    expect(onSelectDirectory).not.toHaveBeenCalled()

    browserGlobal.showDirectoryPicker = originalPicker
    Object.defineProperty(browserGlobal, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })
})
