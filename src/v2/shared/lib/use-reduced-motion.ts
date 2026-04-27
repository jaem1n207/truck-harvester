'use client'

import { useReducedMotion } from 'motion/react'

import {
  getMotionPreset,
  type V2MotionPresetName,
} from '@/v2/design-system/motion'

export function getReducedMotionPreset(
  name: V2MotionPresetName,
  prefersReducedMotion: boolean
) {
  return getMotionPreset(name, prefersReducedMotion)
}

export function useV2ReducedMotion() {
  return Boolean(useReducedMotion())
}

export function useV2MotionPreset(name: V2MotionPresetName) {
  return getReducedMotionPreset(name, useV2ReducedMotion())
}
