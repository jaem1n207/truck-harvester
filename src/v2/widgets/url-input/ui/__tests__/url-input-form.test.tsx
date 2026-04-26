import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'

import { UrlInputForm } from '../url-input-form'

describe('UrlInputForm', () => {
  it('renders Korean-only labels and a submit control for non-technical staff', () => {
    const html = renderToStaticMarkup(<UrlInputForm onSubmit={vi.fn()} />)

    expect(html).toContain(v2Copy.urlInput.title)
    expect(html).toContain(v2Copy.urlInput.placeholder)
    expect(html).toContain(v2Copy.urlInput.submit)
    expect(html).toContain('data-tour="url-input"')
    expect(html).not.toContain('URL')
    expect(html).not.toContain('API')
  })
})
