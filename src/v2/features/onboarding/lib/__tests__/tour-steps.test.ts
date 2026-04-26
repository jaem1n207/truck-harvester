import { describe, expect, it } from 'vitest'

import { findTourAnchor, tourSteps } from '../tour-steps'

describe('tour steps', () => {
  it('defines a short Korean tour without technical jargon', () => {
    expect(tourSteps).toHaveLength(4)

    for (const step of tourSteps) {
      expect(step.title).toMatch(/[가-힣]/)
      expect(step.description).toMatch(/[가-힣]/)
      expect(`${step.title} ${step.description}`).not.toMatch(
        /URL|API|directory handle/
      )
    }
  })

  it('uses a safe fallback when the target anchor is missing', () => {
    document.body.innerHTML = '<main data-tour="v2-page"></main>'

    const anchor = findTourAnchor(tourSteps[0], document)

    expect(anchor).toBeInstanceOf(HTMLElement)
    expect(anchor?.getAttribute('data-tour')).toBe('v2-page')
  })
})
