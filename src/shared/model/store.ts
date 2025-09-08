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
  hasTriedRestore: boolean
  isRehydrated: boolean
  setIsRehydrated: (state: boolean) => void
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
      hasTriedRestore: false,
      isRehydrated: false,
      setIsRehydrated: (state) => set({ isRehydrated: state }),
      restorePersistedDirectoryHandle: async () => {
        console.log('[store] Attempting directory handle restoration...')

        // 복원 시도 플래그 설정 (디버깅용, 차단용이 아님)
        set({ hasTriedRestore: true })

        try {
          console.log(
            '[store] Attempting to restore persisted directory handle...'
          )
          const restoredHandle = await restoreDirectoryHandle()

          if (restoredHandle) {
            console.log(
              '[store] Directory handle restored, checking permissions...'
            )

            // 먼저 핸들을 설정하여 UI가 복원 상태를 알 수 있도록 함
            set({ directoryHandle: restoredHandle })
            set((state) => ({
              config: {
                ...state.config,
                selectedDirectory: restoredHandle.name,
              },
            }))

            // Chrome Persistent Permissions: 저장된 Handle에 대해 requestPermission 호출
            // 이전에 "Allow on every visit"을 선택했다면 즉시 granted 반환
            // 그렇지 않다면 3-way prompt 표시
            const hasPermission =
              await checkAndRequestPermission(restoredHandle)

            if (hasPermission) {
              console.log(
                '[store] Persistent permissions confirmed - directory handle restored successfully'
              )
              // 권한이 확인되었으므로 핸들을 다시 저장 (영구 권한 유지)
              try {
                const { storeDirectoryHandle } = await import(
                  '@/shared/lib/file-system'
                )
                await storeDirectoryHandle(restoredHandle)
              } catch (storeError) {
                console.warn(
                  '[store] Failed to re-store directory handle:',
                  storeError
                )
              }
            } else {
              console.log(
                '[store] Persistent permissions denied, clearing directory handle and stored data'
              )
              // 권한이 거부되었으면 상태와 저장된 핸들을 모두 정리
              set({ directoryHandle: null })
              set((state) => ({
                config: {
                  ...state.config,
                  selectedDirectory: undefined,
                },
              }))

              try {
                const { clearStoredDirectoryHandle } = await import(
                  '@/shared/lib/file-system'
                )
                await clearStoredDirectoryHandle()
              } catch (clearError) {
                console.warn(
                  '[store] Failed to clear stored directory handle:',
                  clearError
                )
              }
            }
          } else {
            console.log('[store] No persisted directory handle found')
          }
        } catch (error) {
          console.warn(
            '[store] Failed to restore persisted directory handle:',
            error
          )
          // 복원 실패 시 저장된 핸들도 정리
          try {
            const { clearStoredDirectoryHandle } = await import(
              '@/shared/lib/file-system'
            )
            await clearStoredDirectoryHandle()
          } catch (clearError) {
            console.warn(
              '[store] Failed to clear stored directory handle after restore failure:',
              clearError
            )
          }
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
          hasTriedRestore: false, // reset 시 복원 플래그도 초기화
        }),
    }),
    {
      name: 'truck-harvester-storage',
      partialize: (state) => ({
        config: state.config,
        urlsText: state.urlsText,
      }),
      onRehydrateStorage: () => {
        console.log('[store] Starting rehydration...')
        return (state, error) => {
          if (error) {
            console.error('[store] Rehydration failed:', error)
          } else {
            console.log(
              '[store] Rehydration completed, calling setIsRehydrated',
              { rehydratedConfig: state?.config }
            )
            state?.setIsRehydrated(true)
          }
        }
      },
    }
  )
)
