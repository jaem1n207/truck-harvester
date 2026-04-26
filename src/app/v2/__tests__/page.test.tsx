import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'

import V2Page from '../page'

describe('V2Page', () => {
  it('provides a stable fallback anchor for onboarding', () => {
    const html = renderToStaticMarkup(<V2Page />)

    expect(html).toContain('data-tour="v2-page"')
  })

  it('renders the operational v2 flow instead of the placeholder preview', () => {
    const html = renderToStaticMarkup(<V2Page />)

    expect(html).toContain(v2Copy.urlInput.title)
    expect(html).toContain('저장 폴더 선택')
    expect(html).toContain('진행 상황')
    expect(html).toContain('도움말')
    expect(html).not.toContain('작업 흐름 미리보기')
    expect(html).not.toContain('뼈대')
  })
})
