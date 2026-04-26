import { describe, expect, it } from 'vitest'

import { getMotionPreset, v2MotionDurations, v2MotionPresets } from '../motion'

describe('v2 motion tokens', () => {
  it('defines the planned duration scale', () => {
    expect(v2MotionDurations).toEqual({
      micro: 150,
      quick: 200,
      default: 250,
      slow: 400,
    })
  })

  it('removes transform and transition when reduced motion is requested', () => {
    expect(getMotionPreset('streamPop', true)).toEqual({
      initial: false,
      animate: {},
      transition: { duration: 0 },
    })
  })

  it('keeps the streaming pop preset expressive by default', () => {
    expect(getMotionPreset('streamPop', false)).toEqual(
      v2MotionPresets.streamPop
    )
    expect(v2MotionPresets.streamPop.initial).toMatchObject({
      opacity: 0,
      scale: 0.96,
    })
  })
})
