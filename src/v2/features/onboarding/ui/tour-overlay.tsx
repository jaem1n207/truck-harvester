'use client'

import { motion } from 'motion/react'

import { useV2MotionPreset } from '@/v2/shared/lib/use-reduced-motion'

import { type TourStep, tourSteps } from '../lib/tour-steps'

interface TourOverlayProps {
  isOpen: boolean
  currentStep: number
  steps?: readonly TourStep[]
  onNext: () => void
  onClose: () => void
}

export function TourOverlay({
  isOpen,
  currentStep,
  steps = tourSteps,
  onNext,
  onClose,
}: TourOverlayProps) {
  const stepTransition = useV2MotionPreset('stepTransition')

  if (!isOpen) {
    return null
  }

  const step = steps[Math.min(currentStep, steps.length - 1)]
  const isLastStep = currentStep >= steps.length - 1

  return (
    <div
      aria-modal="true"
      className="bg-background/70 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
      role="dialog"
    >
      <motion.div
        className="border-border bg-card text-card-foreground w-full max-w-md rounded-xl border p-5 shadow-lg"
        data-motion="step-transition"
        key={step.id}
        {...stepTransition}
      >
        <div className="grid gap-2">
          <p className="text-muted-foreground text-xs font-medium">
            {currentStep + 1} / {steps.length}
          </p>
          <h2 className="text-lg font-semibold">{step.title}</h2>
          <p className="text-muted-foreground text-sm">{step.description}</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="text-muted-foreground hover:bg-muted rounded-lg px-3 py-2 text-sm"
            onClick={onClose}
            type="button"
          >
            그만 보기
          </button>
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-2 text-sm font-medium"
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
