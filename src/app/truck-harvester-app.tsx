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
  type ReadyPreparedListing,
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
  trackSaveCompleted,
  trackSaveFailed,
  trackSaveStarted,
  type SaveMethod,
} from '@/v2/shared/lib/analytics'
import { createOnboardingStore } from '@/v2/shared/model'
import { DirectorySelector } from '@/v2/widgets/directory-selector'
import { PreparedListingStatusPanel } from '@/v2/widgets/processing-status'
import { ListingChipInput, parseUrlInputText } from '@/v2/widgets/url-input'

const saveFailureMessage =
  '저장하지 못했어요. 저장 폴더와 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
const saveFolderPickerId = 'truck-harvester-v2-save-folder'
const missingListingIdentityPlaceholder = '차명 정보 없음'
const useBrowserLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

type DirectoryPermissionState = 'denied' | 'ready'
type DirectoryPickerStartIn = WritableDirectoryHandle | 'downloads'

interface AnalyticsBatchState {
  id: string
  startedAt: number
  urlCount: number
}

interface AnalyticsSaveBatchGroup {
  batch: AnalyticsBatchState
  items: ReadyPreparedListing[]
}

type AnalyticsPreviewItem =
  | { id: string; url: string; status: 'ready' }
  | { id: string; url: string; status: 'failed' | 'invalid'; message: string }

interface BatchAnalyticsSaveOptions {
  savedCount?: number
  saveFailedCount?: number
  saveMethod?: SaveMethod
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

const isUsableListingIdentity = (value: string) => {
  const trimmedValue = value.trim()

  return (
    trimmedValue.length > 0 &&
    trimmedValue !== missingListingIdentityPlaceholder
  )
}

const getSaveFailureVehicleName = (listing: ReadyPreparedListing['listing']) =>
  [listing.vname, listing.vehicleName].find(isUsableListingIdentity) ||
  listing.vname ||
  listing.vehicleName

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
  const analyticsBatchByListingIdRef = useRef<Map<string, AnalyticsBatchState>>(
    new Map()
  )
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

  const createAnalyticsBatch = (urlCount: number): AnalyticsBatchState => ({
    id: createAnalyticsBatchId(),
    startedAt: getAnalyticsNow(),
    urlCount,
  })

  const getBatchAnalyticsInput = (
    batch: AnalyticsBatchState,
    items: readonly AnalyticsPreviewItem[] = [],
    saveOptions: BatchAnalyticsSaveOptions = {}
  ) => {
    return {
      batchId: batch.id,
      urlCount: batch.urlCount,
      uniqueUrlCount: items.length,
      readyCount: items.filter((item) => item.status === 'ready').length,
      invalidCount: items.filter((item) => item.status === 'invalid').length,
      previewFailedCount: items.filter((item) => item.status === 'failed')
        .length,
      savedCount: saveOptions.savedCount ?? 0,
      saveFailedCount: saveOptions.saveFailedCount ?? 0,
      durationMs: getAnalyticsDuration(batch.startedAt),
      saveMethod: saveOptions.saveMethod,
      filesystemSupported: fileSystemSupported,
      notificationEnabled: isNotificationEnabled(notificationPermission),
    }
  }

  const getAnalyticsPreviewItems = (
    prepareResult: Awaited<ReturnType<typeof prepareListingUrls>>
  ) => {
    const currentItemsById = new Map(
      preparedStore.getState().items.map((item) => [item.id, item])
    )
    const settledItemsById = new Map(
      prepareResult.settledItems.map((item) => [item.id, item])
    )

    return prepareResult.addedItems.flatMap<AnalyticsPreviewItem>((runItem) => {
      const currentItem = currentItemsById.get(runItem.id)

      if (currentItem) {
        if (currentItem.status === 'ready') {
          return [
            {
              id: currentItem.id,
              url: currentItem.url,
              status: 'ready',
            },
          ]
        }

        if (
          currentItem.status === 'invalid' ||
          currentItem.status === 'failed'
        ) {
          return [
            {
              id: currentItem.id,
              url: currentItem.url,
              status: currentItem.status,
              message: currentItem.message,
            },
          ]
        }
      }

      const settledItem = settledItemsById.get(runItem.id)

      return settledItem ? [settledItem] : []
    })
  }

  const getReadyAnalyticsItems = (
    items: readonly ReadyPreparedListing[]
  ): AnalyticsPreviewItem[] =>
    items.map((item) => ({
      id: item.id,
      url: item.url,
      status: 'ready',
    }))

  const getSaveBatchGroups = (
    items: readonly ReadyPreparedListing[]
  ): AnalyticsSaveBatchGroup[] => {
    const groups: AnalyticsSaveBatchGroup[] = []
    const groupsByBatchId = new Map<string, AnalyticsSaveBatchGroup>()

    items.forEach((item) => {
      const batch = analyticsBatchByListingIdRef.current.get(item.id)

      if (!batch) {
        return
      }

      const currentGroup = groupsByBatchId.get(batch.id)

      if (currentGroup) {
        currentGroup.items.push(item)
        return
      }

      const nextGroup = { batch, items: [item] }

      groupsByBatchId.set(batch.id, nextGroup)
      groups.push(nextGroup)
    })

    return groups
  }

  const ensureFallbackSaveAnalyticsBatch = (
    items: readonly ReadyPreparedListing[]
  ) => {
    const unmappedItems = items.filter(
      (item) => !analyticsBatchByListingIdRef.current.has(item.id)
    )

    if (unmappedItems.length === 0) {
      return
    }

    const fallbackBatch = createAnalyticsBatch(unmappedItems.length)

    unmappedItems.forEach((item) => {
      analyticsBatchByListingIdRef.current.set(item.id, fallbackBatch)
    })
  }

  const getSaveBatchCounts = (
    group: AnalyticsSaveBatchGroup,
    savedItemIds: ReadonlySet<string>
  ) => ({
    savedCount: group.items.filter((item) => savedItemIds.has(item.id)).length,
    saveFailedCount: group.items.filter((item) =>
      saveFailureIdsRef.current.has(item.id)
    ).length,
  })

  const getSaveBatchAnalyticsInput = (
    group: AnalyticsSaveBatchGroup,
    saveMethod: SaveMethod,
    savedItemIds: ReadonlySet<string>
  ) =>
    getBatchAnalyticsInput(group.batch, getReadyAnalyticsItems(group.items), {
      ...getSaveBatchCounts(group, savedItemIds),
      saveMethod,
    })

  const trackSaveListingFailure = (item: ReadyPreparedListing) => {
    const batch = analyticsBatchByListingIdRef.current.get(item.id)

    if (!batch) {
      return
    }

    trackListingFailed({
      batchId: batch.id,
      failureStage: 'save',
      failureReason: saveFailureMessage,
      listingUrl: item.url,
      vehicleNumber: item.listing.vnumber,
      vehicleName: getSaveFailureVehicleName(item.listing),
      imageCount: item.listing.images.length,
      elapsedMs: getAnalyticsDuration(batch.startedAt),
    })
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

    const analyticsBatch = createAnalyticsBatch(result.urls.length)
    trackBatchStarted({
      ...getBatchAnalyticsInput(analyticsBatch),
      uniqueUrlCount: result.urls.length,
    })

    const previewController = new AbortController()
    previewControllersRef.current.add(previewController)

    void prepareListingUrls({
      urls: result.urls,
      store: preparedStore,
      signal: previewController.signal,
    })
      .then((prepareResult) => {
        if (!isMountedRef.current || previewController.signal.aborted) {
          return
        }

        prepareResult.addedItems.forEach((item) => {
          analyticsBatchByListingIdRef.current.set(item.id, analyticsBatch)
        })

        const batchItems = getAnalyticsPreviewItems(prepareResult)

        trackPreviewCompleted(
          getBatchAnalyticsInput(analyticsBatch, batchItems)
        )

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

        if (pasteSequenceRef.current === pasteSequence) {
          setDuplicateMessage(
            prepareResult.duplicates.length > 0 ? '이미 넣은 매물이에요.' : null
          )
        }
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

      const saveMethod: SaveMethod = runDirectory ? 'directory' : 'zip'
      const savedItemIds = new Set<string>()
      ensureFallbackSaveAnalyticsBatch(itemsToSave)
      const saveBatchGroups = getSaveBatchGroups(itemsToSave)

      itemsToSave.forEach((item) => {
        saveFailureIdsRef.current.delete(item.id)
      })

      saveBatchGroups.forEach((group) => {
        trackSaveStarted(
          getSaveBatchAnalyticsInput(group, saveMethod, savedItemIds)
        )
      })

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
            savedItemIds.add(item.id)
            savedCount += 1
          } catch {
            if (!canContinueSave()) {
              return
            }

            saveFailureIdsRef.current.add(item.id)
            trackSaveListingFailure(item)
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
            savedItemIds.add(item.id)
          })
          savedCount = itemsToSave.length
        } catch {
          if (!canContinueSave()) {
            return
          }

          itemsToSave.forEach((item) => {
            saveFailureIdsRef.current.add(item.id)
          })

          itemsToSave.forEach((item) => {
            trackSaveListingFailure(item)
          })

          itemsToSave.forEach((item) => {
            preparedStore.getState().markFailed(item.url, saveFailureMessage)
          })
        }
      }

      saveBatchGroups.forEach((group) => {
        const saveCounts = getSaveBatchCounts(group, savedItemIds)
        const saveAnalyticsInput = getSaveBatchAnalyticsInput(
          group,
          saveMethod,
          savedItemIds
        )

        if (saveCounts.savedCount === group.items.length) {
          trackSaveCompleted(saveAnalyticsInput)
          return
        }

        trackSaveFailed(saveAnalyticsInput)
      })

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
                onRemove={(id) => {
                  analyticsBatchByListingIdRef.current.delete(id)
                  saveFailureIdsRef.current.delete(id)
                  preparedStore.getState().remove(id)
                }}
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
