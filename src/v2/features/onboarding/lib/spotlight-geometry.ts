export interface TargetRect {
  left: number
  top: number
  width: number
  height: number
}

export interface ViewportRect {
  width: number
  height: number
}

interface PopoverRect {
  width: number
  height: number
}

const spotlightMargin = 16
const popoverGap = 16

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function getSpotlightRect(
  target: TargetRect,
  viewport: ViewportRect,
  padding = 10
): TargetRect {
  const paddedLeft = target.left - padding
  const paddedTop = target.top - padding
  const paddedRight = target.left + target.width + padding
  const paddedBottom = target.top + target.height + padding

  const left = clamp(paddedLeft, 0, viewport.width)
  const top = clamp(paddedTop, 0, viewport.height)
  const right = clamp(paddedRight, 0, viewport.width)
  const bottom = clamp(paddedBottom, 0, viewport.height)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

export function getPopoverPosition(
  spotlight: TargetRect,
  viewport: ViewportRect,
  popover: PopoverRect
) {
  const centeredLeft = spotlight.left + spotlight.width / 2 - popover.width / 2
  const maxLeft = viewport.width - popover.width - spotlightMargin
  const left = clamp(centeredLeft, spotlightMargin, maxLeft)
  const belowTop = spotlight.top + spotlight.height + popoverGap
  const top =
    belowTop + popover.height + spotlightMargin <= viewport.height
      ? belowTop
      : spotlight.top - popover.height - popoverGap
  const maxTop = viewport.height - popover.height - spotlightMargin

  return {
    left,
    top: clamp(top, spotlightMargin, maxTop),
  }
}
