import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  checkAndRequestPermission,
  type FileSystemDirectoryHandle,
  restoreDirectoryHandle,
} from '@/shared/lib/file-system'

import {
  type AppConfig,
  type DownloadStatus,
  type ParseResponse,
  type TruckData,
} from './truck'

interface AppState {
  // Configuration
  config: AppConfig
  updateConfig: (config: Partial<AppConfig>) => void

  // Directory handle (separate from config for type safety)
  directoryHandle: FileSystemDirectoryHandle | null
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void

  // Persistent permissions support
  restorePersistedDirectoryHandle: () => Promise<void>

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
  selectedDirectory: undefined, // 기본값 null로 설정하여 사용자가 반드시 선택하도록 함
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

      // Directory handle (not persisted for security reasons)
      directoryHandle: null,
      setDirectoryHandle: (handle) => set({ directoryHandle: handle }),

      // Persistent permissions support
      restorePersistedDirectoryHandle: async () => {
        try {
          console.log(
            '[store] Attempting to restore persisted directory handle...'
          )
          const restoredHandle = await restoreDirectoryHandle()

          if (restoredHandle) {
            console.log(
              '[store] Directory handle restored, checking permissions...'
            )

            // Chrome Persistent Permissions: 저장된 Handle에 대해 requestPermission 호출
            // 이전에 권한을 부여받았고 IndexedDB에 저장된 Handle이라면 3-way prompt가 표시됨
            const hasPermission =
              await checkAndRequestPermission(restoredHandle)

            if (hasPermission) {
              console.log(
                '[store] Persistent permissions granted, restoring directory handle'
              )
              set({ directoryHandle: restoredHandle })

              // config의 selectedDirectory도 업데이트
              set((state) => ({
                config: {
                  ...state.config,
                  selectedDirectory: restoredHandle.name,
                },
              }))
            } else {
              console.log('[store] Persistent permissions denied')
            }
          } else {
            console.log('[store] No persisted directory handle found')
          }
        } catch (error) {
          console.warn(
            '[store] Failed to restore persisted directory handle:',
            error
          )
        }
      },

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
          directoryHandle: null,
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
