import { describe, expect, it } from 'vitest'

import { findTourAnchor, tourSteps } from '../tour-steps'

describe('tour steps', () => {
  it('defines a short Korean tour without technical jargon', () => {
    expect(tourSteps).toHaveLength(3)

    for (const step of tourSteps) {
      expect(step.title).toMatch(/[가-힣]/)
      expect(step.description).toMatch(/[가-힣]/)
      expect(`${step.title} ${step.description}`).not.toMatch(
        /URL|API|directory handle/
      )
    }
  })

  it('explains pasted addresses in plain staff language', () => {
    expect(tourSteps[0].description).toBe(
      '복사한 매물 주소를 이 칸에 붙여넣으면, 매물 이름을 자동으로 찾아 보여줍니다.'
    )
  })

  it('uses a safe fallback when the target anchor is missing', () => {
    const fallback = {
      getAttribute: (name: string) => (name === 'data-tour' ? 'v2-page' : null),
    }
    const root = {
      querySelector: (selector: string) =>
        selector === '[data-tour="v2-page"]' ? fallback : null,
    }

    const anchor = findTourAnchor(tourSteps[0], root)

    expect(anchor?.getAttribute('data-tour')).toBe('v2-page')
  })

  it('only points to anchors rendered by the chip workbench', () => {
    expect(tourSteps.map((step) => step.anchorSelector)).toEqual([
      '[data-tour="url-input"]',
      '[data-tour="directory-selector"]',
      '[data-tour="processing-status"]',
    ])
  })
})
