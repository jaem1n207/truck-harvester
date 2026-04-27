import JSZip from 'jszip'

import { type TruckListing } from '@/v2/entities/truck'

import {
  buildImageFileName,
  buildTextFileName,
  buildTruckFolderName,
} from './filename'
import { buildTruckTextContent } from './text-content'

interface CreateTruckZipBlobOptions {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

interface DownloadTruckZipOptions extends CreateTruckZipBlobOptions {
  date?: Date
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

async function fetchImageBytes(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`이미지를 불러오지 못했습니다: ${response.status}`)
  }

  return response.arrayBuffer()
}

export async function createTruckZipBlob(
  trucks: readonly TruckListing[],
  { onProgress, signal }: CreateTruckZipBlobOptions = {}
) {
  const zip = new JSZip()

  for (const [truckIndex, truck] of trucks.entries()) {
    assertNotAborted(signal)

    const folder = zip.folder(buildTruckFolderName(truck.vnumber))

    if (!folder) {
      continue
    }

    folder.file(buildTextFileName(truck.vnumber), buildTruckTextContent(truck))

    for (const [imageIndex, imageUrl] of truck.images.entries()) {
      assertNotAborted(signal)

      try {
        const imageBytes = await fetchImageBytes(imageUrl, signal)

        assertNotAborted(signal)
        folder.file(buildImageFileName(imageIndex), imageBytes)
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }

        assertNotAborted(signal)
        continue
      }
    }

    assertNotAborted(signal)
    onProgress?.(Math.round(((truckIndex + 1) / trucks.length) * 100))
  }

  assertNotAborted(signal)
  const blob = await zip.generateAsync({ type: 'blob' })

  assertNotAborted(signal)
  return blob
}

export async function downloadTruckZip(
  trucks: readonly TruckListing[],
  { date = new Date(), ...options }: DownloadTruckZipOptions = {}
) {
  const blob = await createTruckZipBlob(trucks, options)

  assertNotAborted(options.signal)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `truck-data-${date.toISOString().slice(0, 10)}.zip`

  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
