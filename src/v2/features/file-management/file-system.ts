import { type TruckListing } from '@/v2/entities/truck'

import {
  buildManuscriptFileName,
  buildManuscriptFolderName,
  buildPerformanceCheckFolderName,
  buildPerformanceCheckImageFileName,
  buildTruckFolderName,
  buildVehicleImageFileName,
  buildVehicleImagesFolderName,
} from './filename'
import {
  capturePerformanceCheckImages as defaultCapturePerformanceCheckImages,
  type CapturePerformanceCheckImagesOptions,
} from './performance-check-capture'
import { type TruckSaveResult } from './save-result'
import { buildTruckTextContent } from './text-content'

interface WritableFileStream {
  write: (data: FileSystemWriteChunkType) => Promise<void>
  close: () => Promise<void>
}

interface WritableFileHandle {
  createWritable: () => Promise<WritableFileStream>
}

type WritableDirectoryPermissionDescriptor = { mode: 'readwrite' }
const WRITABLE_PERMISSION_DESCRIPTOR = { mode: 'readwrite' } as const

export interface WritableDirectoryHandle {
  kind?: 'directory'
  name?: string
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<WritableDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<WritableFileHandle>
  queryPermission?: (
    descriptor: WritableDirectoryPermissionDescriptor
  ) => Promise<PermissionState>
  requestPermission?: (
    descriptor: WritableDirectoryPermissionDescriptor
  ) => Promise<PermissionState>
}

interface SaveTruckToDirectoryOptions {
  capturePerformanceCheckImages?: CapturePerformanceCheckImages
  onProgress?: (progress: number, downloaded: number, total: number) => void
  signal?: AbortSignal
}

type CapturePerformanceCheckImages = (
  performanceCheckUrl?: string | null,
  options?: CapturePerformanceCheckImagesOptions
) => Promise<Uint8Array[]>

interface PickWritableDirectoryOptions {
  id?: string
  startIn?: WritableDirectoryHandle
}

interface WritableDirectoryPickerOptions {
  id?: string
  mode: 'readwrite'
  startIn?: WritableDirectoryHandle
}

type WritableDirectoryPicker = (
  options: WritableDirectoryPickerOptions
) => Promise<WritableDirectoryHandle>

export function isFileSystemAccessAvailable() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function requestWritableDirectoryPermission(
  handle: WritableDirectoryHandle
) {
  if (!handle.requestPermission) {
    return true
  }

  try {
    return (
      (await handle.requestPermission(WRITABLE_PERMISSION_DESCRIPTOR)) ===
      'granted'
    )
  } catch {
    return false
  }
}

export async function pickWritableDirectory({
  id,
  startIn,
}: PickWritableDirectoryOptions = {}) {
  const picker = window.showDirectoryPicker as WritableDirectoryPicker

  if (!picker) {
    return undefined
  }

  try {
    return (await picker({
      id,
      mode: 'readwrite',
      startIn,
    })) as WritableDirectoryHandle
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return undefined
    }

    throw error
  }
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('다운로드가 취소되었습니다.', 'AbortError')
  }
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'

const getVehicleImageStatus = (
  downloadedImages: number,
  totalImages: number
): TruckSaveResult['vehicleImageStatus'] =>
  downloadedImages === totalImages ? 'complete' : 'partial'

async function writeFile(
  directory: WritableDirectoryHandle,
  name: string,
  data: FileSystemWriteChunkType
) {
  const fileHandle = await directory.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()

  await writable.write(data)
  await writable.close()
}

async function fetchImageBlob(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`이미지를 불러오지 못했습니다: ${response.status}`)
  }

  return response.blob()
}

async function savePerformanceCheckImages({
  capturePerformanceCheckImages,
  performanceCheckUrl,
  signal,
  vehicleDirectory,
}: {
  capturePerformanceCheckImages: CapturePerformanceCheckImages
  performanceCheckUrl?: string | null
  signal?: AbortSignal
  vehicleDirectory: WritableDirectoryHandle
}) {
  const trimmedUrl = performanceCheckUrl?.trim()

  if (!trimmedUrl) {
    return {
      performanceCheckImageCount: 0,
      performanceCheckStatus: 'not_requested',
    } satisfies Pick<
      TruckSaveResult,
      'performanceCheckImageCount' | 'performanceCheckStatus'
    >
  }

  try {
    const images = await capturePerformanceCheckImages(trimmedUrl, { signal })

    assertNotAborted(signal)

    if (images.length === 0) {
      return {
        performanceCheckImageCount: 0,
        performanceCheckStatus: 'missing',
      } satisfies Pick<
        TruckSaveResult,
        'performanceCheckImageCount' | 'performanceCheckStatus'
      >
    }

    const directory = await vehicleDirectory.getDirectoryHandle(
      buildPerformanceCheckFolderName(),
      { create: true }
    )

    for (const [index, imageBytes] of images.entries()) {
      assertNotAborted(signal)
      await writeFile(
        directory,
        buildPerformanceCheckImageFileName(index),
        new Blob([imageBytes as Uint8Array<ArrayBuffer>], {
          type: 'image/jpeg',
        })
      )
    }

    return {
      performanceCheckImageCount: images.length,
      performanceCheckStatus: 'saved',
    } satisfies Pick<
      TruckSaveResult,
      'performanceCheckImageCount' | 'performanceCheckStatus'
    >
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }

    assertNotAborted(signal)

    return {
      performanceCheckImageCount: 0,
      performanceCheckStatus: 'missing',
    } satisfies Pick<
      TruckSaveResult,
      'performanceCheckImageCount' | 'performanceCheckStatus'
    >
  }
}

export async function saveTruckToDirectory(
  rootDirectory: WritableDirectoryHandle,
  truck: TruckListing,
  {
    capturePerformanceCheckImages = defaultCapturePerformanceCheckImages,
    onProgress,
    signal,
  }: SaveTruckToDirectoryOptions = {}
): Promise<TruckSaveResult> {
  assertNotAborted(signal)

  const vehicleFolderName = buildTruckFolderName(truck.vnumber)
  const vehicleDirectory = await rootDirectory.getDirectoryHandle(
    vehicleFolderName,
    { create: true }
  )
  const vehicleImagesDirectory = await vehicleDirectory.getDirectoryHandle(
    buildVehicleImagesFolderName(),
    { create: true }
  )
  const manuscriptDirectory = await vehicleDirectory.getDirectoryHandle(
    buildManuscriptFolderName(),
    { create: true }
  )

  const totalImages = truck.images.length
  let downloadedImages = 0

  onProgress?.(0, downloadedImages, totalImages)

  for (const [index, imageUrl] of truck.images.entries()) {
    assertNotAborted(signal)

    try {
      const imageBlob = await fetchImageBlob(imageUrl, signal)

      assertNotAborted(signal)
      await writeFile(
        vehicleImagesDirectory,
        buildVehicleImageFileName(index),
        imageBlob
      )
      assertNotAborted(signal)
      downloadedImages += 1
      onProgress?.(
        Math.round((downloadedImages / totalImages) * 100),
        downloadedImages,
        totalImages
      )
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      assertNotAborted(signal)
      continue
    }
  }

  const performanceCheckResult = await savePerformanceCheckImages({
    capturePerformanceCheckImages,
    performanceCheckUrl: truck.performanceCheckUrl,
    signal,
    vehicleDirectory,
  })

  assertNotAborted(signal)
  await writeFile(
    manuscriptDirectory,
    buildManuscriptFileName(),
    buildTruckTextContent(truck)
  )
  assertNotAborted(signal)

  return {
    ...performanceCheckResult,
    sourceUrl: truck.url,
    vehicleImageCount: downloadedImages,
    vehicleImageStatus: getVehicleImageStatus(downloadedImages, totalImages),
    vehicleImageTotalCount: totalImages,
    vehicleFolderName,
    vehicleNumber: truck.vnumber,
  }
}
