'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import { motion } from 'motion/react'

import { useV2MotionPreset } from '@/v2/shared/lib/use-reduced-motion'

import {
  getPopoverPosition,
  getSpotlightRect,
  type TargetRect,
  type ViewportRect,
} from '../lib/spotlight-geometry'
import { findTourAnchor, type TourStep, tourSteps } from '../lib/tour-steps'

interface TourOverlayProps {
  isOpen: boolean
  currentStep: number
  steps?: readonly TourStep[]
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

interface TourGeometry {
  spotlight: TargetRect
  popover: {
    left: number
    top: number
  }
  viewport: ViewportRect
}

const popoverSize = {
  width: 384,
  height: 224,
} as const

const fallbackViewport: ViewportRect = {
  width: 1024,
  height: 768,
}

const fallbackTarget: TargetRect = {
  left: 320,
  top: 180,
  width: 384,
  height: 96,
}

const createFallbackGeometry = (): TourGeometry => {
  const spotlight = getSpotlightRect(fallbackTarget, fallbackViewport)

  return {
    spotlight,
    popover: getPopoverPosition(spotlight, fallbackViewport, popoverSize),
    viewport: fallbackViewport,
  }
}

const getViewportRect = (): ViewportRect => ({
  width: window.innerWidth,
  height: window.innerHeight,
})

const getElementRect = (element: Element): TargetRect => {
  const rect = element.getBoundingClientRect()

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

const toFixedPx = (value: number) => `${Math.max(value, 0)}px`

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const getFocusableElements = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (focusableElement) => !focusableElement.hasAttribute('disabled')
  )

export function TourOverlay({
  isOpen,
  currentStep,
  steps = tourSteps,
  onNext,
  onPrevious,
  onClose,
}: TourOverlayProps) {
  const tourCardMotion = useV2MotionPreset('tourCard')
  const tourHighlightMotion = useV2MotionPreset('tourHighlight')
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const [geometry, setGeometry] = useState<TourGeometry>(() =>
    createFallbackGeometry()
  )

  const stepIndex = Math.min(currentStep, steps.length - 1)
  const step = steps[stepIndex]
  const isFirstStep = currentStep <= 0
  const isLastStep = currentStep >= steps.length - 1

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return
    }

    const updateGeometry = () => {
      const viewport = getViewportRect()
      const anchor = findTourAnchor(step, document)
      const target = anchor ? getElementRect(anchor) : fallbackTarget
      const spotlight = getSpotlightRect(target, viewport)

      setGeometry({
        spotlight,
        popover: getPopoverPosition(spotlight, viewport, popoverSize),
        viewport,
      })
    }

    updateGeometry()
    window.addEventListener('resize', updateGeometry)
    window.addEventListener('scroll', updateGeometry, true)

    return () => {
      window.removeEventListener('resize', updateGeometry)
      window.removeEventListener('scroll', updateGeometry, true)
    }
  }, [isOpen, step])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return
    }

    previousActiveElementRef.current =
      typeof window !== 'undefined' &&
      document.activeElement instanceof window.HTMLElement
        ? document.activeElement
        : null

    const focusableElements = dialogRef.current
      ? getFocusableElements(dialogRef.current)
      : []

    focusableElements[0]?.focus()

    return () => {
      previousActiveElementRef.current?.focus()
      previousActiveElementRef.current = null
    }
  }, [isOpen, step.id])

  const dimStyles = useMemo(() => {
    const { spotlight, viewport } = geometry
    const bottomStart = spotlight.top + spotlight.height
    const rightStart = spotlight.left + spotlight.width

    return {
      top: {
        left: 0,
        top: 0,
        width: toFixedPx(viewport.width),
        height: toFixedPx(spotlight.top),
      },
      left: {
        left: 0,
        top: toFixedPx(spotlight.top),
        width: toFixedPx(spotlight.left),
        height: toFixedPx(spotlight.height),
      },
      right: {
        left: toFixedPx(rightStart),
        top: toFixedPx(spotlight.top),
        width: toFixedPx(viewport.width - rightStart),
        height: toFixedPx(spotlight.height),
      },
      bottom: {
        left: 0,
        top: toFixedPx(bottomStart),
        width: toFixedPx(viewport.width),
        height: toFixedPx(viewport.height - bottomStart),
      },
    } satisfies Record<string, CSSProperties>
  }, [geometry])

  const highlightStyle: CSSProperties = {
    left: toFixedPx(geometry.spotlight.left),
    top: toFixedPx(geometry.spotlight.top),
    width: toFixedPx(geometry.spotlight.width),
    height: toFixedPx(geometry.spotlight.height),
  }

  const popoverStyle: CSSProperties = {
    left: toFixedPx(geometry.popover.left),
    top: toFixedPx(geometry.popover.top),
    width: `min(calc(100vw - 32px), ${popoverSize.width}px)`,
  }

  if (!isOpen) {
    return null
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = getFocusableElements(event.currentTarget)

    if (focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey) {
      if (
        activeElement === firstElement ||
        activeElement === event.currentTarget
      ) {
        event.preventDefault()
        lastElement.focus()
      }

      return
    }

    if (
      activeElement === lastElement ||
      !event.currentTarget.contains(activeElement)
    ) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50"
      data-tour-modal-root="true"
      onKeyDown={handleDialogKeyDown}
      ref={dialogRef}
      role="dialog"
    >
      <div
        className="bg-background/70 fixed backdrop-blur-sm"
        data-tour-dim="top"
        style={dimStyles.top}
      />
      <div
        className="bg-background/70 fixed backdrop-blur-sm"
        data-tour-dim="left"
        style={dimStyles.left}
      />
      <div
        className="bg-background/70 fixed backdrop-blur-sm"
        data-tour-dim="right"
        style={dimStyles.right}
      />
      <div
        className="bg-background/70 fixed backdrop-blur-sm"
        data-tour-dim="bottom"
        style={dimStyles.bottom}
      />
      <motion.div
        aria-hidden="true"
        className="border-primary shadow-primary/25 fixed rounded-2xl border-2 shadow-lg"
        data-motion="tour-highlight"
        data-tour-highlight="true"
        key={step.id}
        style={highlightStyle}
        {...tourHighlightMotion}
      />
      <motion.div
        className="border-border bg-card text-card-foreground fixed max-h-[calc(100dvh-32px)] overflow-y-auto rounded-xl border p-5 shadow-lg"
        data-motion="tour-card"
        data-tour-card="true"
        key={`${step.id}-card`}
        style={popoverStyle}
        {...tourCardMotion}
      >
        <div className="grid gap-2">
          <p className="text-muted-foreground text-xs font-medium">
            {currentStep + 1} / {steps.length}
          </p>
          <h2 className="text-lg font-semibold">{step.title}</h2>
          <p className="text-muted-foreground text-sm">{step.description}</p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            className="text-muted-foreground hover:bg-muted rounded-lg px-3 py-2 text-sm"
            data-tour-control="close"
            onClick={onClose}
            type="button"
          >
            그만 보기
          </button>
          <button
            className="text-muted-foreground hover:bg-muted disabled:text-muted-foreground/50 rounded-lg px-3 py-2 text-sm disabled:hover:bg-transparent"
            data-tour-control="previous"
            disabled={isFirstStep}
            onClick={onPrevious}
            type="button"
          >
            이전
          </button>
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-2 text-sm font-medium"
            data-tour-control="next"
            onClick={onNext}
            type="button"
          >
            {isLastStep ? '마치기' : '다음'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
