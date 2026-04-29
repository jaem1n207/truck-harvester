'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useStore } from 'zustand'

import {
  CompletionNotificationToggle,
  isCompletionNotificationAvailable,
  notifyCompletion,
  requestCompletionNotificationPermission,
} from '@/v2/features/completion-notification'
import {
  downloadTruckZip,
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  requestWritableDirectoryPermission,
  saveTruckToDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import {
  createPreparedListingStore,
  prepareListingUrls,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
  type PreparedListing,
} from '@/v2/features/listing-preparation'
import {
  HelpMenuButton,
  TourOverlay,
  tourSteps,
} from '@/v2/features/onboarding'
import {
  createAnalyticsBatchId,
  trackBatchStarted,
  trackListingFailed,
  trackPreviewCompleted,
  type SaveMethod,
} from '@/v2/shared/lib/analytics'
import { createOnboardingStore } from '@/v2/shared/model'
import { DirectorySelector } from '@/v2/widgets/directory-selector'
import { PreparedListingStatusPanel } from '@/v2/widgets/processing-status'
import { ListingChipInput, parseUrlInputText } from '@/v2/widgets/url-input'

const saveFailureMessage =
  '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
const saveFolderPickerId = 'truck-harvester-v2-save-folder'
const useBrowserLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

type DirectoryPermissionState = 'denied' | 'ready'
type DirectoryPickerStartIn = WritableDirectoryHandle | 'downloads'

interface AnalyticsBatchState {
  id: string
  startedAt: number
  urlCount: number
  started: boolean
}

const pickSaveDirectory = pickWritableDirectory as (options: {
  id: string
  startIn: DirectoryPickerStartIn
}) => Promise<WritableDirectoryHandle | undefined>

const requestNextFrame = (callback: () => void) => {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }

  return window.setTimeout(callback, 16)
}

const cancelNextFrame = (handle: number) => {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle)
    return
  }

  window.clearTimeout(handle)
}

const getAnalyticsNow = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

const getAnalyticsDuration = (startedAt: number) =>
  Math.max(0, Math.round(getAnalyticsNow() - startedAt))

const isNotificationEnabled = (
  permission: NotificationPermission | 'unsupported'
) => permission === 'granted'

export function TruckHarvesterApp() {
  const [preparedStore] = useState(() => createPreparedListingStore())
  const [onboardingStore] = useState(() =>
    createOnboardingStore({ deferInitialTour: true })
  )
  const [directory, setDirectory] = useState<WritableDirectoryHandle | null>(
    null
  )
  const [directoryPermissionState, setDirectoryPermissionState] =
    useState<DirectoryPermissionState>('ready')
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null)
  const [fileSystemSupported, setFileSystemSupported] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [notificationAvailable, setNotificationAvailable] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported')
  const isMountedRef = useRef(false)
  const pasteSequenceRef = useRef(0)
  const previewControllersRef = useRef<Set<AbortController>>(new Set())
  const saveControllerRef = useRef<AbortController | null>(null)
  const analyticsBatchRef = useRef<AnalyticsBatchState | null>(null)
  const listingBatchIdsRef = useRef<Map<string, string>>(new Map())
  const previewFailureIdsRef = useRef<Set<string>>(new Set())
  const saveFailureIdsRef = useRef<Set<string>>(new Set())

  const preparedState = useStore(preparedStore, (state) => state)
  const onboardingState = useStore(onboardingStore, (state) => state)
  const readyListings = selectReadyPreparedListings(preparedState)
  const checkingListings = selectCheckingPreparedListings(preparedState)
  const inputListings = preparedState.items.filter(
    (item) => item.status !== 'saved'
  )

  useBrowserLayoutEffect(() => {
    const supported = isFileSystemAccessAvailable()
    setFileSystemSupported(supported)
    setDirectoryPermissionState('ready')

    if (isCompletionNotificationAvailable()) {
      setNotificationAvailable(true)
      setNotificationPermission(window.Notification.permission)
    }

    const frame = requestNextFrame(() => {
      onboardingStore.getState().initializeTour()
    })

    return () => {
      cancelNextFrame(frame)
    }
  }, [onboardingStore])

  useEffect(() => {
    isMountedRef.current = true
    const previewControllers = previewControllersRef.current

    return () => {
      isMountedRef.current = false
      previewControllers.forEach((controller) => controller.abort())
      previewControllers.clear()
      saveControllerRef.current?.abort()
      saveControllerRef.current = null
    }
  }, [])

  const resolveSaveDirectoryForRun = async () => {
    if (!isFileSystemAccessAvailable()) {
      return null
    }

    const activeDirectory = directory

    if (activeDirectory) {
      if (directoryPermissionState === 'denied') {
        const nextDirectory = await pickSaveDirectory({
          id: saveFolderPickerId,
          startIn: 'downloads',
        })

        if (!nextDirectory) {
          return undefined
        }

        if (isMountedRef.current) {
          setDirectory(nextDirectory)
          setDirectoryPermissionState('ready')
        }

        return nextDirectory
      }

      const hasPermission =
        await requestWritableDirectoryPermission(activeDirectory)

      if (!hasPermission) {
        if (isMountedRef.current) {
          setDirectoryPermissionState('denied')
        }
        return undefined
      }

      if (isMountedRef.current) {
        setDirectory(activeDirectory)
        setDirectoryPermissionState('ready')
      }

      return activeDirectory
    }

    const nextDirectory = await pickSaveDirectory({
      id: saveFolderPickerId,
      startIn: 'downloads',
    })

    if (!nextDirectory) {
      return undefined
    }

    if (isMountedRef.current) {
      setDirectory(nextDirectory)
      setDirectoryPermissionState('ready')
    }

    return nextDirectory
  }

  const selectDirectory = async (nextDirectory: WritableDirectoryHandle) => {
    if (isMountedRef.current) {
      setDirectory(nextDirectory)
      setDirectoryPermissionState('ready')
    }
  }

  const hasOpenPreparedItems = () =>
    preparedStore.getState().items.some((item) => item.status !== 'saved')

  const getActiveAnalyticsBatch = () => {
    if (!analyticsBatchRef.current || !hasOpenPreparedItems()) {
      analyticsBatchRef.current = {
        id: createAnalyticsBatchId(),
        startedAt: getAnalyticsNow(),
        urlCount: 0,
        started: false,
      }
    }

    return analyticsBatchRef.current
  }

  const getAnalyticsItemsForBatch = (batchId: string) =>
    preparedStore
      .getState()
      .items.filter(
        (item) => listingBatchIdsRef.current.get(item.id) === batchId
      )

  const getBatchAnalyticsInput = (
    batch: AnalyticsBatchState,
    saveMethod?: SaveMethod
  ) => {
    const items = getAnalyticsItemsForBatch(batch.id)

    return {
      batchId: batch.id,
      urlCount: batch.urlCount,
      uniqueUrlCount: items.length,
      readyCount: items.filter((item) => item.status === 'ready').length,
      invalidCount: items.filter((item) => item.status === 'invalid').length,
      previewFailedCount: items.filter((item) =>
        previewFailureIdsRef.current.has(item.id)
      ).length,
      savedCount: items.filter((item) => item.status === 'saved').length,
      saveFailedCount: items.filter((item) =>
        saveFailureIdsRef.current.has(item.id)
      ).length,
      durationMs: getAnalyticsDuration(batch.startedAt),
      saveMethod,
      filesystemSupported: fileSystemSupported,
      notificationEnabled: isNotificationEnabled(notificationPermission),
    }
  }

  const handlePasteText = (text: string) => {
    const pasteSequence = pasteSequenceRef.current + 1
    pasteSequenceRef.current = pasteSequence
    const result = parseUrlInputText(text)

    if (!result.success) {
      if (isMountedRef.current && pasteSequenceRef.current === pasteSequence) {
        setDuplicateMessage(result.message)
      }
      return
    }

    const analyticsBatch = getActiveAnalyticsBatch()
    analyticsBatch.urlCount += result.urls.length

    if (!analyticsBatch.started) {
      analyticsBatch.started = true
      trackBatchStarted({
        ...getBatchAnalyticsInput(analyticsBatch),
        uniqueUrlCount: result.urls.length,
      })
    }

    const previewController = new AbortController()
    previewControllersRef.current.add(previewController)

    void prepareListingUrls({
      urls: result.urls,
      store: preparedStore,
      signal: previewController.signal,
    })
      .then((prepareResult) => {
        if (
          !isMountedRef.current ||
          previewController.signal.aborted ||
          pasteSequenceRef.current !== pasteSequence
        ) {
          return
        }

        const batchItems = preparedStore
          .getState()
          .items.filter((item) => prepareResult.added.includes(item.url))

        batchItems.forEach((item) => {
          listingBatchIdsRef.current.set(item.id, analyticsBatch.id)
        })

        batchItems.forEach((item) => {
          if (item.status === 'failed') {
            previewFailureIdsRef.current.add(item.id)
          }
        })

        trackPreviewCompleted(getBatchAnalyticsInput(analyticsBatch))

        batchItems.forEach((item) => {
          if (item.status !== 'invalid' && item.status !== 'failed') {
            return
          }

          trackListingFailed({
            batchId: analyticsBatch.id,
            failureStage: item.status === 'invalid' ? 'invalid_url' : 'preview',
            failureReason: item.message,
            listingUrl: item.url,
            elapsedMs: getAnalyticsDuration(analyticsBatch.startedAt),
          })
        })

        setDuplicateMessage(
          prepareResult.duplicates.length > 0 ? '이미 넣은 매물이에요.' : null
        )
      })
      .catch(() => {
        // Preview cancellation is expected when leaving the route.
      })
      .finally(() => {
        previewControllersRef.current.delete(previewController)
      })
  }

  const requestNotificationPermission = () => {
    void requestCompletionNotificationPermission().then((permission) => {
      if (isMountedRef.current) {
        setNotificationPermission(permission)
      }
    })
  }

  const startSavingReadyListings = async () => {
    if (isSaving || readyListings.length === 0 || checkingListings.length > 0) {
      return
    }

    const controller = new AbortController()
    saveControllerRef.current?.abort()
    saveControllerRef.current = controller
    const canContinueSave = () =>
      isMountedRef.current && !controller.signal.aborted

    try {
      const runDirectory = await resolveSaveDirectoryForRun()

      if (!canContinueSave()) {
        return
      }

      if (runDirectory === undefined) {
        return
      }

      const itemsToSave = readyListings
      setIsSaving(true)

      let savedCount = 0

      if (runDirectory) {
        for (const item of itemsToSave) {
          if (!canContinueSave()) {
            return
          }

          preparedStore.getState().markSaving(item.id, {
            downloadedImages: 0,
            totalImages: item.listing.images.length,
            progress: 0,
          })

          try {
            await saveTruckToDirectory(runDirectory, item.listing, {
              signal: controller.signal,
              onProgress: (progress, downloadedImages, totalImages) => {
                if (!canContinueSave()) {
                  return
                }

                preparedStore.getState().markSaving(item.id, {
                  progress,
                  downloadedImages,
                  totalImages,
                })
              },
            })

            if (!canContinueSave()) {
              return
            }

            preparedStore.getState().markSaved(item.id)
            savedCount += 1
          } catch {
            if (!canContinueSave()) {
              return
            }

            preparedStore.getState().markFailed(item.url, saveFailureMessage)
          }
        }
      } else {
        itemsToSave.forEach((item) => {
          preparedStore.getState().markSaving(item.id, {
            downloadedImages: 0,
            totalImages: item.listing.images.length,
            progress: 0,
          })
        })

        try {
          await downloadTruckZip(
            itemsToSave.map((item) => item.listing),
            {
              signal: controller.signal,
              onProgress: (progress) => {
                if (!canContinueSave()) {
                  return
                }

                itemsToSave.forEach((item) => {
                  preparedStore.getState().markSaving(item.id, {
                    progress,
                    downloadedImages: 0,
                    totalImages: item.listing.images.length,
                  })
                })
              },
            }
          )

          if (!canContinueSave()) {
            return
          }

          itemsToSave.forEach((item) => {
            preparedStore.getState().markSaved(item.id)
          })
          savedCount = itemsToSave.length
        } catch {
          if (!canContinueSave()) {
            return
          }

          itemsToSave.forEach((item) => {
            preparedStore.getState().markFailed(item.url, saveFailureMessage)
          })
        }
      }

      if (savedCount > 0 && canContinueSave()) {
        notifyCompletion(savedCount)
      }
    } finally {
      if (saveControllerRef.current === controller) {
        saveControllerRef.current = null
      }

      if (isMountedRef.current) {
        setIsSaving(false)
      }
    }
  }

  const canRemovePreparedItem = (item: PreparedListing) =>
    item.status !== 'saving' && item.status !== 'saved'

  return (
    <main
      className="bg-background text-foreground min-h-dvh"
      data-tour="v2-page"
    >
      <section className="mx-auto grid min-h-dvh w-full max-w-6xl gap-6 px-6 py-8 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              새 작업 화면
            </p>
            <h1 className="text-foreground text-2xl font-semibold tracking-normal">
              트럭 매물 수집기
            </h1>
          </div>
          <HelpMenuButton onRestartTour={onboardingState.restartTour} />
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="grid content-start gap-5">
            <div data-tour="url-input">
              <ListingChipInput
                canRemoveItem={canRemovePreparedItem}
                disabled={isSaving}
                duplicateMessage={duplicateMessage}
                items={inputListings}
                onPasteText={handlePasteText}
                onRemove={(id) => preparedStore.getState().remove(id)}
                onStart={() => void startSavingReadyListings()}
              />
            </div>
          </div>

          <div className="grid content-start gap-5">
            <DirectorySelector
              isSupported={fileSystemSupported}
              onSelectDirectory={selectDirectory}
              permissionState={directoryPermissionState}
              pickerStartIn={
                directoryPermissionState === 'denied'
                  ? 'downloads'
                  : (directory ?? 'downloads')
              }
              selectedDirectoryName={directory?.name}
            />
            <CompletionNotificationToggle
              isAvailable={notificationAvailable}
              onEnable={requestNotificationPermission}
              permission={notificationPermission}
            />
            <div data-tour="processing-status">
              <PreparedListingStatusPanel items={preparedState.items} />
            </div>
          </div>
        </div>
      </section>

      <TourOverlay
        currentStep={onboardingState.currentStep}
        isOpen={onboardingState.isTourOpen}
        onClose={onboardingState.completeTour}
        onNext={() => onboardingState.goToNextStep(tourSteps.length)}
        onPrevious={onboardingState.goToPreviousStep}
      />
    </main>
  )
}
