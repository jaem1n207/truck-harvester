import JSZip from 'jszip'

import { TruckData } from '@/shared/model/truck'

interface FileSystemHandle {
  requestPermission?: (options?: { mode: string }) => Promise<PermissionState>
  kind: string
  name: string
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory'
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemFileHandle>
  values: () => AsyncIterableIterator<
    FileSystemDirectoryHandle | FileSystemFileHandle
  >
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file'
  createWritable: () => Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream {
  write: (data: string | Uint8Array) => Promise<void>
  close: () => Promise<void>
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
}

export const isFileSystemAccessSupported = () => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export const selectDirectory =
  async (): Promise<FileSystemDirectoryHandle | null> => {
    if (!isFileSystemAccessSupported()) {
      throw new Error('File System Access API가 지원되지 않는 브라우저입니다.')
    }

    try {
      const dirHandle = await window.showDirectoryPicker!()
      return dirHandle
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null // 사용자가 취소함
      }
      throw error
    }
  }

const generateImageFileName = (index: number): string => {
  const paddedIndex = String(index + 1).padStart(3, '0')
  return `K-${paddedIndex}.jpg`
}

const generateTextContent = (truckData: TruckData): string => {
  const template = `=== 차량 정보 ===
차명: {{vname}}
차량번호: {{vnumber}}
제목: {{title}}

=== 가격 정보 ===
가격: {{price.label}} ({{price.compactLabel}})
원 단위: {{price.rawWon}}원

=== 차량 세부사항 ===
연식: {{year}}
주행거리: {{mileage}}

=== 추가 정보 ===
기타사항/옵션: {{options}}

=== 원본 정보 ===
URL: {{url}}
최초등록: {{firstRegistration}}

=== 이미지 정보 ===
이미지 개수: {{imageCount}}개
다운로드 파일명: K-001.jpg ~ K-{{paddedCount}}.jpg

=== 이미지 URL 목록 ===
{{imageUrls}}

=== 메타데이터 ===
생성일시: {{generatedAt}}
생성 버전: v2.0`

  // 이미지 URL 목록 생성
  const imageUrls =
    truckData.images.length > 0
      ? truckData.images
          .map(
            (url, index) =>
              `K-${String(index + 1).padStart(3, '0')}.jpg: ${url}`
          )
          .join('\n')
      : '이미지 없음'

  const paddedCount = String(truckData.images.length).padStart(3, '0')

  return template
    .replace('{{vname}}', truckData.vname)
    .replace('{{vnumber}}', truckData.vnumber)
    .replace('{{title}}', truckData.title)
    .replace('{{price.label}}', truckData.price.label)
    .replace('{{price.compactLabel}}', truckData.price.compactLabel)
    .replace('{{price.rawWon}}', truckData.price.rawWon.toLocaleString())
    .replace('{{year}}', truckData.year)
    .replace('{{mileage}}', truckData.mileage)
    .replace('{{options}}', truckData.options)
    .replace('{{url}}', truckData.url)
    .replace('{{firstRegistration}}', truckData.firstRegistration)
    .replace('{{imageCount}}', String(truckData.images.length))
    .replace('{{paddedCount}}', paddedCount)
    .replace('{{imageUrls}}', imageUrls)
    .replace('{{generatedAt}}', new Date().toLocaleString('ko-KR'))
}

export const downloadTruckData = async (
  rootDirectoryHandle: FileSystemDirectoryHandle,
  truckData: TruckData,
  onProgress?: (progress: number, downloaded: number, total: number) => void,
  abortSignal?: AbortSignal
): Promise<void> => {
  if (abortSignal?.aborted) {
    throw new Error('다운로드가 취소되었습니다.')
  }

  const folderName = truckData.vnumber.replace(/[<>:"/\\|?*]/g, '_')
  const vehicleDir = await rootDirectoryHandle.getDirectoryHandle(folderName, {
    create: true,
  })

  // 텍스트 파일 생성
  const textFileName = `${truckData.vnumber} 원고.txt`
  const textFileHandle = await vehicleDir.getFileHandle(textFileName, {
    create: true,
  })
  const textWritable = await textFileHandle.createWritable()
  await textWritable.write(generateTextContent(truckData))
  await textWritable.close()

  const totalImages = truckData.images.length
  let downloadedImages = 0

  onProgress?.(0, downloadedImages, totalImages)

  for (let i = 0; i < truckData.images.length; i++) {
    if (abortSignal?.aborted) {
      throw new Error('다운로드가 취소되었습니다.')
    }

    const imageUrl = truckData.images[i]
    const fileName = generateImageFileName(i)

    try {
      const response = await fetch(imageUrl, { signal: abortSignal })
      if (!response.ok) {
        console.warn(`이미지 다운로드 실패: ${imageUrl}`)
        continue
      }

      const arrayBuffer = await response.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const imageFileHandle = await vehicleDir.getFileHandle(fileName, {
        create: true,
      })
      const imageWritable = await imageFileHandle.createWritable()
      await imageWritable.write(uint8Array)
      await imageWritable.close()

      downloadedImages++
      const progress = Math.round((downloadedImages / totalImages) * 100)
      onProgress?.(progress, downloadedImages, totalImages)
    } catch (error) {
      console.warn(`이미지 다운로드 오류: ${imageUrl}`, error)
    }
  }
}

export const downloadAsZip = async (
  truckDataList: TruckData[],
  onProgress?: (progress: number) => void,
  abortSignal?: AbortSignal
): Promise<void> => {
  const zip = new JSZip()
  let processedCount = 0

  for (const truckData of truckDataList) {
    if (abortSignal?.aborted) {
      throw new Error('다운로드가 취소되었습니다.')
    }

    const folderName = truckData.vnumber.replace(/[<>:"/\\|?*]/g, '_')
    const folder = zip.folder(folderName)

    if (!folder) {
      continue
    }

    // 텍스트 파일 추가
    const textFileName = `${truckData.vnumber} 원고.txt`
    folder.file(textFileName, generateTextContent(truckData))

    // 이미지 다운로드 및 추가
    for (let i = 0; i < truckData.images.length; i++) {
      if (abortSignal?.aborted) {
        throw new Error('다운로드가 취소되었습니다.')
      }

      const imageUrl = truckData.images[i]
      const fileName = generateImageFileName(i)

      try {
        const response = await fetch(imageUrl, { signal: abortSignal })
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          folder.file(fileName, arrayBuffer)
        }
      } catch (error) {
        console.warn(`이미지 다운로드 오류: ${imageUrl}`, error)
      }
    }

    processedCount++
    const progress = Math.round((processedCount / truckDataList.length) * 100)
    onProgress?.(progress)
  }

  // ZIP 파일 생성 및 다운로드
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)

  const a = document.createElement('a')
  a.href = url
  a.download = `truck-data-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
