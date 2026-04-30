'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useStore } from 'zustand'

import {
  isCompletionNotificationAvailable,
  notifyCompletion,
  requestCompletionNotificationPermission,
} from '@/v2/features/completion-notification'
import {
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  requestWritableDirectoryPermission,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import {
  createPreparedListingStore,
  selectCheckingPreparedListings,
  selectReadyPreparedListings,
  type PreparedListing,
} from '@/v2/features/listing-preparation'
import { type SaveMethod } from '@/v2/shared/lib/analytics'
import { createOnboardingStore } from '@/v2/shared/model'

import { runPreviewWorkflow } from './preview-workflow'
import { runSaveWorkflow } from './save-workflow'
import {
  createWorkflowAnalytics,
  type WorkflowTracker,
} from './workflow-analytics'

const saveFolderPickerId = 'truck-harvester-v2-save-folder'
const useBrowserLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

type DirectoryPermissionState = 'denied' | 'ready'
type DirectoryPickerStartIn = WritableDirectoryHandle | 'downloads'

const pickSaveDirectory = pickWritableDirectory as (options: {
  id: string
  startIn: DirectoryPickerStartIn
}) => Promise<WritableDirectoryHandle | undefined>

const requestNextFrame = (callback: () => void) => {
  if (
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function'
  ) {
    return window.requestAnimationFrame(callback)
  }

  return window.setTimeout(callback, 16)
}

const cancelNextFrame = (handle: number) => {
  if (
    typeof window !== 'undefined' &&
    typeof window.cancelAnimationFrame === 'function'
  ) {
    window.cancelAnimationFrame(handle)
    return
  }

  window.clearTimeout(handle)
}

const getWorkflowNow = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

const isNotificationEnabled = (
  permission: NotificationPermission | 'unsupported'
) => permission === 'granted'

export function useTruckHarvesterWorkflow() {
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
  const fileSystemSupportedRef = useRef(false)
  const notificationEnabledRef = useRef(false)
  const trackerRef = useRef<WorkflowTracker | null>(null)

  const preparedState = useStore(preparedStore, (state) => state)
  const onboardingState = useStore(onboardingStore, (state) => state)
  const readyListings = selectReadyPreparedListings(preparedState)
  const checkingListings = selectCheckingPreparedListings(preparedState)
  const preparedItems = preparedState.items
  const inputListings = preparedItems.filter((item) => item.status !== 'saved')
  const isTourOpen = onboardingState.isTourOpen
  const pickerStartIn: DirectoryPickerStartIn =
    directoryPermissionState === 'denied'
      ? 'downloads'
      : (directory ?? 'downloads')

  const getTracker = () => {
    trackerRef.current ??= createWorkflowAnalytics({
      getFilesystemSupported: () => fileSystemSupportedRef.current,
      getNotificationEnabled: () => notificationEnabledRef.current,
    })

    return trackerRef.current
  }

  useBrowserLayoutEffect(() => {
    getTracker()

    const supported = isFileSystemAccessAvailable()
    fileSystemSupportedRef.current = supported
    setFileSystemSupported(supported)
    setDirectoryPermissionState('ready')

    if (isCompletionNotificationAvailable()) {
      const permission = window.Notification.permission
      notificationEnabledRef.current = isNotificationEnabled(permission)
      setNotificationAvailable(true)
      setNotificationPermission(permission)
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

  const handlePasteText = (text: string) => {
    const tracker = getTracker()
    const pasteStartedAt = getWorkflowNow()
    const pasteSequence = pasteSequenceRef.current + 1
    pasteSequenceRef.current = pasteSequence
    const previewController = new AbortController()

    previewControllersRef.current.add(previewController)

    void runPreviewWorkflow({
      getStartedAt: () => pasteStartedAt,
      signal: previewController.signal,
      store: preparedStore,
      text,
      tracker,
    })
      .then((result) => {
        if (
          !isMountedRef.current ||
          previewController.signal.aborted ||
          pasteSequenceRef.current !== pasteSequence
        ) {
          return
        }

        setDuplicateMessage(result.duplicateMessage)
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
      notificationEnabledRef.current = isNotificationEnabled(permission)

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
    const tracker = getTracker()
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
      const saveMethod: SaveMethod = runDirectory ? 'directory' : 'zip'
      setIsSaving(true)

      const { savedCount } = await runSaveWorkflow({
        directory: runDirectory,
        items: itemsToSave,
        saveMethod,
        signal: controller.signal,
        store: preparedStore,
        tracker,
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

  const removePreparedItem = (id: string) => {
    const tracker = getTracker()

    tracker.removeListing(id)
    preparedStore.getState().remove(id)
  }

  const canRemovePreparedItem = (item: PreparedListing) =>
    item.status !== 'saving' && item.status !== 'saved'

  return {
    canRemovePreparedItem,
    directory,
    directoryPermissionState,
    duplicateMessage,
    fileSystemSupported,
    handlePasteText,
    inputListings,
    isSaving,
    isTourOpen,
    notificationAvailable,
    notificationPermission,
    onboardingState,
    pickerStartIn,
    preparedItems,
    removePreparedItem,
    requestNotificationPermission,
    selectDirectory,
    startSavingReadyListings,
  }
}
