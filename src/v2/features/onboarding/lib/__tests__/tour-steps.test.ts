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

  it('pairs each step with a compact example card kind', () => {
    expect(tourSteps.map((step) => step.exampleKind)).toEqual([
      'url-example',
      'folder-example',
      'progress-example',
    ])
  })

  it('explains full address-bar copying in plain staff language', () => {
    expect(tourSteps[0].title).toBe('매물 주소를 넣어요')
    expect(tourSteps[0].description).toBe(
      '주소창에 있는 매물 주소를 처음부터 끝까지 복사해 붙여넣으세요. 복사한 내용 안에 매물 주소가 들어 있으면 자동으로 찾아요.'
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
