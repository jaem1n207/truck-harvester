import { describe, expect, it } from 'vitest'

import { getPopoverPosition, getSpotlightRect } from '../spotlight-geometry'

describe('spotlight geometry', () => {
  it('adds padding around target inside viewport', () => {
    expect(
      getSpotlightRect(
        { left: 18, top: 28, width: 304, height: 124 },
        { width: 640, height: 480 }
      )
    ).toEqual({ left: 8, top: 18, width: 324, height: 144 })
  })

  it('clamps spotlight at the viewport edge', () => {
    expect(
      getSpotlightRect(
        { left: -12, top: -20, width: 120, height: 110 },
        { width: 118, height: 100 }
      )
    ).toEqual({ left: 0, top: 0, width: 118, height: 100 })
  })

  it('places the popover below the spotlight when there is room', () => {
    expect(
      getPopoverPosition(
        { left: 80, top: 120, width: 220, height: 100 },
        { width: 500, height: 500 },
        { width: 180, height: 90 }
      )
    ).toEqual({ left: 100, top: 236 })
  })

  it('places the popover above the spotlight when below would overflow', () => {
    expect(
      getPopoverPosition(
        { left: 80, top: 520, width: 220, height: 80 },
        { width: 500, height: 600 },
        { width: 180, height: 90 }
      )
    ).toEqual({ left: 100, top: 414 })
  })

  it('keeps the popover visible when it is wider than the viewport', () => {
    const position = getPopoverPosition(
      { left: 100, top: 120, width: 80, height: 80 },
      { width: 280, height: 500 },
      { width: 320, height: 90 }
    )

    expect(position.left).toBeGreaterThanOrEqual(0)
  })

  it('keeps the popover visible when it is taller than the viewport', () => {
    const position = getPopoverPosition(
      { left: 100, top: 260, width: 80, height: 80 },
      { width: 500, height: 280 },
      { width: 180, height: 320 }
    )

    expect(position.top).toBeGreaterThanOrEqual(0)
  })
})
