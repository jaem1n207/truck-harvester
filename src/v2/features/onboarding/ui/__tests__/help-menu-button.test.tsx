import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { HelpMenuButton } from '../help-menu-button'

describe('HelpMenuButton', () => {
  it('renders a Korean help control that can restart the tour', () => {
    const html = renderToStaticMarkup(
      <HelpMenuButton onRestartTour={vi.fn()} />
    )

    expect(html).toContain('도움말')
    expect(html).toContain('처음 안내 다시 보기')
  })
})
