import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { TruckData, DownloadStatus, AppConfig, ParseResponse } from './truck'

interface AppState {
  // Configuration
  config: AppConfig
  updateConfig: (config: Partial<AppConfig>) => void

  // URLs and validation
  urlsText: string
  setUrlsText: (text: string) => void

  // Parsed truck data
  truckData: TruckData[]
  setTruckData: (data: TruckData[]) => void

  // Download status
  downloadStatuses: DownloadStatus[]
  setDownloadStatus: (
    vehicleNumber: string,
    status: Partial<DownloadStatus>
  ) => void
  resetDownloadStatuses: () => void

  // UI state
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void

  currentStep: 'input' | 'parsing' | 'downloading' | 'completed'
  setCurrentStep: (step: AppState['currentStep']) => void

  // Abort controller for cancellation
  abortController: AbortController | null
  setAbortController: (controller: AbortController | null) => void

  // Parse result
  parseResult: ParseResponse | null
  setParseResult: (result: ParseResponse | null) => void

  // Time tracking
  startTime: Date | null
  setStartTime: (time: Date | null) => void

  // Actions
  reset: () => void
}

const initialConfig: AppConfig = {
  rateLimitMs: 1000,
  timeoutMs: 10000,
  maxRetries: 3,
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Configuration
      config: initialConfig,
      updateConfig: (newConfig) =>
        set((state) => ({ config: { ...state.config, ...newConfig } })),

      // URLs and validation
      urlsText: '',
      setUrlsText: (text) => set({ urlsText: text }),

      // Parsed truck data
      truckData: [],
      setTruckData: (data) => set({ truckData: data }),

      // Download status
      downloadStatuses: [],
      setDownloadStatus: (vehicleNumber, statusUpdate) =>
        set((state) => {
          const existingIndex = state.downloadStatuses.findIndex(
            (s) => s.vehicleNumber === vehicleNumber
          )

          if (existingIndex >= 0) {
            const newStatuses = [...state.downloadStatuses]
            newStatuses[existingIndex] = {
              ...newStatuses[existingIndex],
              ...statusUpdate,
            }
            return { downloadStatuses: newStatuses }
          } else {
            return {
              downloadStatuses: [
                ...state.downloadStatuses,
                {
                  vehicleNumber,
                  status: 'pending' as const,
                  progress: 0,
                  downloadedImages: 0,
                  totalImages: 0,
                  ...statusUpdate,
                },
              ],
            }
          }
        }),

      resetDownloadStatuses: () => set({ downloadStatuses: [] }),

      // UI state
      isProcessing: false,
      setIsProcessing: (processing) => set({ isProcessing: processing }),

      currentStep: 'input',
      setCurrentStep: (step) => set({ currentStep: step }),

      // Abort controller
      abortController: null,
      setAbortController: (controller) => set({ abortController: controller }),

      // Parse result
      parseResult: null,
      setParseResult: (result) => set({ parseResult: result }),

      // Time tracking
      startTime: null,
      setStartTime: (time) => set({ startTime: time }),

      // Actions
      reset: () =>
        set({
          urlsText: '',
          truckData: [],
          downloadStatuses: [],
          isProcessing: false,
          currentStep: 'input',
          abortController: null,
          parseResult: null,
          startTime: null,
        }),
    }),
    {
      name: 'truck-harvester-storage',
      partialize: (state) => ({
        config: state.config,
        urlsText: state.urlsText,
      }),
    }
  )
)
