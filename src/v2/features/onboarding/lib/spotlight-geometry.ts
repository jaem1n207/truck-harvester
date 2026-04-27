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

const getPopoverAxisPosition = (
  value: number,
  viewportSize: number,
  popoverSize: number
) => {
  const maxPosition = viewportSize - popoverSize - spotlightMargin

  if (maxPosition < spotlightMargin) {
    return clamp(value, 0, Math.max(maxPosition, 0))
  }

  return clamp(value, spotlightMargin, maxPosition)
}

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
  const left = getPopoverAxisPosition(
    centeredLeft,
    viewport.width,
    popover.width
  )
  const belowTop = spotlight.top + spotlight.height + popoverGap
  const top =
    belowTop + popover.height + spotlightMargin <= viewport.height
      ? belowTop
      : spotlight.top - popover.height - popoverGap

  return {
    left,
    top: getPopoverAxisPosition(top, viewport.height, popover.height),
  }
}
