export const v2MotionDurations = {
  micro: 150,
  quick: 200,
  default: 250,
  slow: 400,
} as const

export const v2MotionEasings = {
  easeOut: [0.16, 1, 0.3, 1],
  springSoft: {
    type: 'spring',
    stiffness: 220,
    damping: 24,
  },
  springSnappy: {
    type: 'spring',
    stiffness: 420,
    damping: 30,
  },
} as const

export const reducedMotionPreset = {
  initial: false,
  animate: {},
  transition: { duration: 0 },
} as const

export const v2MotionPresets = {
  itemEnter: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: v2MotionDurations.quick / 1000,
      ease: v2MotionEasings.easeOut,
    },
  },
  stepTransition: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: v2MotionDurations.default / 1000,
      ease: v2MotionEasings.easeOut,
    },
  },
  tourCard: {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: {
      duration: v2MotionDurations.default / 1000,
      ease: v2MotionEasings.easeOut,
    },
  },
  tourHighlight: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    transition: {
      duration: v2MotionDurations.quick / 1000,
      ease: v2MotionEasings.easeOut,
    },
  },
  streamPop: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    transition: {
      duration: v2MotionDurations.quick / 1000,
      ease: v2MotionEasings.easeOut,
    },
  },
  shimmer: {
    initial: { backgroundPositionX: '100%' },
    animate: { backgroundPositionX: '0%' },
    transition: {
      duration: v2MotionDurations.slow / 1000,
      ease: 'linear',
      repeat: Infinity,
    },
  },
} as const

export type V2MotionPresetName = keyof typeof v2MotionPresets

export function getMotionPreset(
  name: V2MotionPresetName,
  prefersReducedMotion: boolean
) {
  if (prefersReducedMotion) {
    return reducedMotionPreset
  }

  return v2MotionPresets[name]
}
