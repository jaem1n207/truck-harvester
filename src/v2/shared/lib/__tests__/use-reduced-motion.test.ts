import { describe, expect, it } from 'vitest'

import { getReducedMotionPreset } from '../use-reduced-motion'

describe('reduced motion helper', () => {
  it('returns a no-op preset when reduced motion is active', () => {
    expect(getReducedMotionPreset('stepTransition', true)).toEqual({
      initial: false,
      animate: {},
      transition: { duration: 0 },
    })
  })
})
