import JSZip from 'jszip'

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

interface CreateTruckZipBlobOptions {
  capturePerformanceCheckImages?: CapturePerformanceCheckImages
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

interface DownloadTruckZipOptions extends CreateTruckZipBlobOptions {
  date?: Date
}

type CapturePerformanceCheckImages = (
  performanceCheckUrl?: string | null,
  options?: CapturePerformanceCheckImagesOptions
) => Promise<Uint8Array[]>

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

async function fetchImageBytes(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`이미지를 불러오지 못했습니다: ${response.status}`)
  }

  return response.arrayBuffer()
}

async function addPerformanceCheckImagesToFolder({
  capturePerformanceCheckImages,
  vehicleFolder,
  performanceCheckUrl,
  signal,
  vehicleNumber,
}: {
  capturePerformanceCheckImages: CapturePerformanceCheckImages
  vehicleFolder: JSZip
  performanceCheckUrl?: string | null
  signal?: AbortSignal
  vehicleNumber: string
}) {
  const trimmedUrl = performanceCheckUrl?.trim()

  if (!trimmedUrl) {
    return {
      performanceCheckImageCount: 0,
      performanceCheckStatus: 'missing',
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

    const folder = vehicleFolder.folder(buildPerformanceCheckFolderName())

    if (!folder) {
      return {
        performanceCheckImageCount: 0,
        performanceCheckStatus: 'missing',
      } satisfies Pick<
        TruckSaveResult,
        'performanceCheckImageCount' | 'performanceCheckStatus'
      >
    }

    for (const [index, imageBytes] of images.entries()) {
      assertNotAborted(signal)
      folder.file(
        buildPerformanceCheckImageFileName(index, vehicleNumber),
        imageBytes
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

export async function createTruckZipArchive(
  trucks: readonly TruckListing[],
  {
    capturePerformanceCheckImages = defaultCapturePerformanceCheckImages,
    onProgress,
    signal,
  }: CreateTruckZipBlobOptions = {}
) {
  const zip = new JSZip()
  const results: TruckSaveResult[] = []

  for (const [truckIndex, truck] of trucks.entries()) {
    assertNotAborted(signal)

    const vehicleFolderName = buildTruckFolderName(truck.vnumber)
    const folder = zip.folder(vehicleFolderName)

    if (!folder) {
      continue
    }

    const vehicleImagesFolder = folder.folder(buildVehicleImagesFolderName())
    const manuscriptFolder = folder.folder(buildManuscriptFolderName())

    if (!vehicleImagesFolder || !manuscriptFolder) {
      continue
    }

    let downloadedImages = 0

    for (const [imageIndex, imageUrl] of truck.images.entries()) {
      assertNotAborted(signal)

      try {
        const imageBytes = await fetchImageBytes(imageUrl, signal)

        assertNotAborted(signal)
        vehicleImagesFolder.file(
          buildVehicleImageFileName(imageIndex),
          imageBytes
        )
        downloadedImages += 1
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }

        assertNotAborted(signal)
        continue
      }
    }

    const performanceCheckResult = await addPerformanceCheckImagesToFolder({
      capturePerformanceCheckImages,
      performanceCheckUrl: truck.performanceCheckUrl,
      signal,
      vehicleFolder: folder,
      vehicleNumber: truck.vnumber,
    })

    assertNotAborted(signal)
    manuscriptFolder.file(
      buildManuscriptFileName(truck.vnumber),
      buildTruckTextContent(truck)
    )

    results.push({
      ...performanceCheckResult,
      sourceUrl: truck.url,
      vehicleImageCount: downloadedImages,
      vehicleImageStatus: getVehicleImageStatus(
        downloadedImages,
        truck.images.length
      ),
      vehicleImageTotalCount: truck.images.length,
      vehicleFolderName,
      vehicleNumber: truck.vnumber,
    })

    assertNotAborted(signal)
    onProgress?.(Math.round(((truckIndex + 1) / trucks.length) * 100))
  }

  assertNotAborted(signal)
  const blob = await zip.generateAsync({ type: 'blob' })

  assertNotAborted(signal)
  return { blob, results }
}

export async function createTruckZipBlob(
  trucks: readonly TruckListing[],
  options: CreateTruckZipBlobOptions = {}
) {
  const { blob } = await createTruckZipArchive(trucks, options)

  return blob
}

export async function downloadTruckZip(
  trucks: readonly TruckListing[],
  { date = new Date(), ...options }: DownloadTruckZipOptions = {}
) {
  const { blob, results } = await createTruckZipArchive(trucks, options)

  assertNotAborted(options.signal)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `truck-data-${date.toISOString().slice(0, 10)}.zip`

  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)

  return results
}
