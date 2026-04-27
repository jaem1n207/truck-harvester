import { describe, expect, it } from 'vitest'

import {
  createOnboardingStore,
  onboardingStorageKey,
  type OnboardingStorage,
} from '../onboarding-store'

const createMemoryStorage = (): OnboardingStorage => {
  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('onboarding store', () => {
  it('can start closed before browser storage is read', () => {
    const store = createOnboardingStore({
      deferInitialTour: true,
      storage: createMemoryStorage(),
    })

    expect(store.getState()).toMatchObject({
      isTourOpen: false,
      hasCompletedTour: false,
      currentStep: 0,
    })
  })

  it('opens a deferred first-visit tour after client mount', () => {
    const store = createOnboardingStore({
      deferInitialTour: true,
      storage: createMemoryStorage(),
    })

    store.getState().initializeTour()

    expect(store.getState()).toMatchObject({
      isTourOpen: true,
      hasCompletedTour: false,
      currentStep: 0,
    })
  })

  it('opens the tour on first visit and stores completion', () => {
    const storage = createMemoryStorage()
    const store = createOnboardingStore({ storage })

    expect(store.getState()).toMatchObject({
      isTourOpen: true,
      hasCompletedTour: false,
      currentStep: 0,
    })

    store.getState().completeTour()

    expect(store.getState()).toMatchObject({
      isTourOpen: false,
      hasCompletedTour: true,
      currentStep: 0,
    })
    expect(storage.getItem(onboardingStorageKey)).toBe('completed')

    const returningStore = createOnboardingStore({ storage })
    expect(returningStore.getState()).toMatchObject({
      isTourOpen: false,
      hasCompletedTour: true,
    })
  })

  it('restarts the tour from the help menu', () => {
    const storage = createMemoryStorage()
    storage.setItem(onboardingStorageKey, 'completed')
    const store = createOnboardingStore({ storage })

    store.getState().restartTour()
    store.getState().goToNextStep(4)

    expect(store.getState()).toMatchObject({
      isTourOpen: true,
      hasCompletedTour: true,
      currentStep: 1,
    })
  })

  it('moves to the previous tour step without going below the first step', () => {
    const store = createOnboardingStore({ storage: createMemoryStorage() })

    store.getState().goToNextStep(4)
    store.getState().goToNextStep(4)
    store.getState().goToPreviousStep()

    expect(store.getState().currentStep).toBe(1)

    store.getState().goToPreviousStep()
    store.getState().goToPreviousStep()

    expect(store.getState().currentStep).toBe(0)
  })
})
