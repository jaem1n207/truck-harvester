'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import { AnimatePresence, motion } from 'motion/react'

import { useV2MotionPreset } from '@/v2/shared/lib/use-reduced-motion'

import {
  getPopoverPosition,
  getSpotlightRect,
  type TargetRect,
  type ViewportRect,
} from '../lib/spotlight-geometry'
import { findTourAnchor, type TourStep, tourSteps } from '../lib/tour-steps'

import { TourExampleCard } from './tour-example-card'

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
  height: 340,
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
const initialLayoutStabilityFrames = 8

const requestLayoutFrame = (callback: FrameRequestCallback) => {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }

  return window.setTimeout(() => callback(Date.now()), 16)
}

const cancelLayoutFrame = (handle: number) => {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle)
    return
  }

  window.clearTimeout(handle)
}

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

const isEditableKeyTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  )
}

const isTourShortcutKey = (key: string) =>
  key === 'Escape' || key === 'ArrowLeft' || key === 'ArrowRight'

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
  const stepTitleId = `tour-overlay-${step.id}-title`
  const stepDescriptionId = `tour-overlay-${step.id}-description`
  const isFirstStep = currentStep <= 0
  const isLastStep = currentStep >= steps.length - 1

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return
    }

    let isCancelled = false
    let updateFrame: number | null = null
    let stabilityFrame: number | null = null

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

    const scheduleGeometryUpdate = () => {
      if (updateFrame !== null) {
        cancelLayoutFrame(updateFrame)
      }

      updateFrame = requestLayoutFrame(() => {
        updateFrame = null

        if (!isCancelled) {
          updateGeometry()
        }
      })
    }

    const scheduleInitialStabilityUpdates = (remainingFrames: number) => {
      if (remainingFrames <= 0 || isCancelled) {
        return
      }

      stabilityFrame = requestLayoutFrame(() => {
        if (!isCancelled) {
          updateGeometry()
          scheduleInitialStabilityUpdates(remainingFrames - 1)
        }
      })
    }

    updateGeometry()
    scheduleInitialStabilityUpdates(initialLayoutStabilityFrames)

    const mutationObserver =
      typeof MutationObserver === 'function'
        ? new MutationObserver(scheduleGeometryUpdate)
        : null
    mutationObserver?.observe(document.body, { childList: true, subtree: true })

    const activeAnchor = findTourAnchor(step, document)
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(scheduleGeometryUpdate)
        : null

    if (activeAnchor) {
      resizeObserver?.observe(activeAnchor)
    }

    const documentWithFonts = document as Document & {
      fonts?: { ready?: Promise<unknown> }
    }
    void documentWithFonts.fonts?.ready?.then(() => {
      if (!isCancelled) {
        scheduleGeometryUpdate()
      }
    })

    window.addEventListener('resize', scheduleGeometryUpdate)
    window.addEventListener('scroll', scheduleGeometryUpdate, true)
    window.addEventListener('pageshow', scheduleGeometryUpdate)
    window.visualViewport?.addEventListener('resize', scheduleGeometryUpdate)
    window.visualViewport?.addEventListener('scroll', scheduleGeometryUpdate)

    return () => {
      isCancelled = true
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleGeometryUpdate)
      window.removeEventListener('scroll', scheduleGeometryUpdate, true)
      window.removeEventListener('pageshow', scheduleGeometryUpdate)
      window.visualViewport?.removeEventListener(
        'resize',
        scheduleGeometryUpdate
      )
      window.visualViewport?.removeEventListener(
        'scroll',
        scheduleGeometryUpdate
      )

      if (updateFrame !== null) {
        cancelLayoutFrame(updateFrame)
      }

      if (stabilityFrame !== null) {
        cancelLayoutFrame(stabilityFrame)
      }
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

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return
    }

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isTourShortcutKey(event.key)) {
        return
      }

      const dialog = dialogRef.current

      if (
        typeof window !== 'undefined' &&
        event.target instanceof window.Node &&
        dialog?.contains(event.target)
      ) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (isEditableKeyTarget(event.target)) {
        return
      }

      if (event.key === 'ArrowLeft') {
        if (!isFirstStep) {
          event.preventDefault()
          onPrevious()
        }

        return
      }

      event.preventDefault()
      onNext()
    }

    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [isFirstStep, isOpen, onClose, onNext, onPrevious])

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

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (isEditableKeyTarget(event.target)) {
        return
      }

      if (event.key === 'ArrowLeft') {
        if (!isFirstStep) {
          event.preventDefault()
          onPrevious()
        }

        return
      }

      event.preventDefault()
      onNext()
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
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.div
          aria-describedby={stepDescriptionId}
          aria-labelledby={stepTitleId}
          aria-modal="true"
          className="fixed inset-0 z-50"
          data-tour-modal-root="true"
          exit={{ opacity: 0 }}
          onKeyDown={handleDialogKeyDown}
          ref={dialogRef}
          role="dialog"
          transition={tourCardMotion.transition}
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
            exit={{ opacity: 0, scale: 0.98 }}
            key={step.id}
            style={highlightStyle}
            {...tourHighlightMotion}
          />
          <motion.div
            className="border-border bg-card text-card-foreground fixed max-h-[calc(100dvh-32px)] overflow-y-auto rounded-xl border p-5 shadow-lg"
            data-motion="tour-card"
            data-tour-card="true"
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            key={`${step.id}-card`}
            style={popoverStyle}
            {...tourCardMotion}
          >
            <div className="grid gap-2">
              <p className="text-muted-foreground text-xs font-medium tabular-nums">
                {currentStep + 1} / {steps.length}
              </p>
              <h2
                className="text-lg font-semibold text-balance"
                id={stepTitleId}
              >
                {step.title}
              </h2>
              <p
                className="text-muted-foreground text-sm text-pretty"
                id={stepDescriptionId}
              >
                {step.description}
              </p>
            </div>

            <TourExampleCard kind={step.exampleKind} />

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="text-muted-foreground hover:bg-muted min-h-10 rounded-lg px-3 py-2 text-sm transition-[background-color,color,scale,transform] active:scale-[0.96]"
                data-tour-control="close"
                onClick={onClose}
                type="button"
              >
                그만 보기
              </button>
              <button
                className="text-muted-foreground hover:bg-muted disabled:text-muted-foreground/50 min-h-10 rounded-lg px-3 py-2 text-sm transition-[background-color,color,opacity,scale,transform] active:scale-[0.96] disabled:hover:bg-transparent disabled:active:scale-100"
                data-tour-control="previous"
                disabled={isFirstStep}
                onClick={onPrevious}
                type="button"
              >
                이전
              </button>
              <button
                className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-10 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,scale,transform] active:scale-[0.96]"
                data-tour-control="next"
                onClick={onNext}
                type="button"
              >
                {isLastStep ? '마치기' : '다음'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
