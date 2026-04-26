import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'

import { DirectorySelector } from '../directory-selector'

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
})
