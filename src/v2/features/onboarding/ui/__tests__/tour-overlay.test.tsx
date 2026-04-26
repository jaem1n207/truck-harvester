import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { tourSteps } from '../../lib/tour-steps'
import { TourOverlay } from '../tour-overlay'

describe('TourOverlay', () => {
  it('renders the current step in an accessible Korean dialog', () => {
    const html = renderToStaticMarkup(
      <TourOverlay
        currentStep={0}
        isOpen
        onClose={vi.fn()}
        onNext={vi.fn()}
        steps={tourSteps}
      />
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain(tourSteps[0].title)
    expect(html).toContain(tourSteps[0].description)
    expect(html).toContain('다음')
    expect(html).toContain('그만 보기')
    expect(html).toContain('data-motion="step-transition"')
  })
})
