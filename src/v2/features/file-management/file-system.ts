import { type TruckListing } from '@/v2/entities/truck'

import {
  buildImageFileName,
  buildTextFileName,
  buildTruckFolderName,
} from './filename'
import { buildTruckTextContent } from './text-content'

interface WritableFileStream {
  write: (data: string | Uint8Array) => Promise<void>
  close: () => Promise<void>
}

interface WritableFileHandle {
  createWritable: () => Promise<WritableFileStream>
}

export interface WritableDirectoryHandle {
  name?: string
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<WritableDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<WritableFileHandle>
}

interface SaveTruckToDirectoryOptions {
  onProgress?: (progress: number, downloaded: number, total: number) => void
  signal?: AbortSignal
}

export function isFileSystemAccessAvailable() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickWritableDirectory() {
  const picker = window.showDirectoryPicker

  if (!picker) {
    return undefined
  }

  try {
    return (await picker()) as WritableDirectoryHandle
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

async function writeFile(
  directory: WritableDirectoryHandle,
  name: string,
  data: string | Uint8Array
) {
  const fileHandle = await directory.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()

  await writable.write(data)
  await writable.close()
}

async function fetchImageBytes(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`이미지를 불러오지 못했습니다: ${response.status}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

export async function saveTruckToDirectory(
  rootDirectory: WritableDirectoryHandle,
  truck: TruckListing,
  { onProgress, signal }: SaveTruckToDirectoryOptions = {}
) {
  assertNotAborted(signal)

  const vehicleDirectory = await rootDirectory.getDirectoryHandle(
    buildTruckFolderName(truck.vnumber),
    { create: true }
  )

  const totalImages = truck.images.length
  let downloadedImages = 0

  onProgress?.(0, downloadedImages, totalImages)

  for (const [index, imageUrl] of truck.images.entries()) {
    assertNotAborted(signal)

    try {
      const imageBytes = await fetchImageBytes(imageUrl, signal)

      assertNotAborted(signal)
      await writeFile(vehicleDirectory, buildImageFileName(index), imageBytes)
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

  assertNotAborted(signal)
  await writeFile(
    vehicleDirectory,
    buildTextFileName(truck.vnumber),
    buildTruckTextContent(truck)
  )
  assertNotAborted(signal)
}
