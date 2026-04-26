import { createStore, type StoreApi } from 'zustand/vanilla'

export interface OnboardingStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface OnboardingStoreOptions {
  storage?: OnboardingStorage
}

export interface OnboardingState {
  isTourOpen: boolean
  hasCompletedTour: boolean
  currentStep: number
  completeTour: () => void
  restartTour: () => void
  goToNextStep: (totalSteps: number) => void
}

export const onboardingStorageKey = 'truck-harvester:v2:onboarding'

const completedValue = 'completed'

const isOnboardingStorage = (
  storage: Storage | OnboardingStorage | undefined
): storage is OnboardingStorage =>
  typeof storage?.getItem === 'function' &&
  typeof storage.setItem === 'function' &&
  typeof storage.removeItem === 'function'

const getBrowserStorage = (): OnboardingStorage | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  if (!isOnboardingStorage(window.localStorage)) {
    return undefined
  }

  return window.localStorage
}

export const createOnboardingStore = ({
  storage = getBrowserStorage(),
}: OnboardingStoreOptions = {}): StoreApi<OnboardingState> => {
  const hasCompletedTour =
    storage?.getItem(onboardingStorageKey) === completedValue

  return createStore<OnboardingState>((set) => ({
    isTourOpen: !hasCompletedTour,
    hasCompletedTour,
    currentStep: 0,
    completeTour: () => {
      storage?.setItem(onboardingStorageKey, completedValue)
      set({
        isTourOpen: false,
        hasCompletedTour: true,
        currentStep: 0,
      })
    },
    restartTour: () =>
      set({
        isTourOpen: true,
        currentStep: 0,
      }),
    goToNextStep: (totalSteps) =>
      set((state) => {
        const finalStep = Math.max(totalSteps - 1, 0)

        if (state.currentStep >= finalStep) {
          storage?.setItem(onboardingStorageKey, completedValue)

          return {
            isTourOpen: false,
            hasCompletedTour: true,
            currentStep: 0,
          }
        }

        return {
          currentStep: state.currentStep + 1,
        }
      }),
  }))
}
