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
  console.log('🚀 ~ generateTextContent ~ truckData:', truckData)
  const template = `{{vname}} 매매 가격 시세
{{price.rawWon}}
생활/건강,공구,운반용품

{{vname}} 매매 가격 시세



차종 :  {{vname}}

차명 :  {{vehicleName}}

차량번호 :  {{vnumber}}

연식 :  {{year}}

주행거리 :  {{mileage}}

기타사항 :  {{options}}




가격 :  {{price.label}}





화물차, 특장차를 전문으로 매매하는 오픈매장으로 

충분한 상담을 통해 용도에 딱 맞는 차량을 권해드리고 있습니다.

최고가 매입, 매매 /전국 어디든 출장 매입 가능!!



언제든지 문의 주시면 최선을 다해 상담하겠습니다.
상담문의 010-4082-8945 트럭판매왕

{{imageUrls}}`

  const imageUrls =
    truckData.images.length > 0
      ? truckData.images
          .map(
            (_, index) => `#사진:K-${String(index + 1).padStart(3, '0')}.jpg`
          )
          .join('\n')
      : '이미지 없음'

  // 모든 플레이스홀더를 전역적으로 변환
  return template
    .replaceAll('{{vname}}', truckData.vname)
    .replaceAll('{{vehicleName}}', truckData.vehicleName) // 추출된 차명 데이터 사용
    .replaceAll('{{vnumber}}', truckData.vnumber)
    .replaceAll('{{price.label}}', truckData.price.label)
    .replaceAll('{{price.rawWon}}', truckData.price.rawWon.toString())
    .replaceAll('{{year}}', truckData.year)
    .replaceAll('{{mileage}}', truckData.mileage)
    .replaceAll('{{options}}', truckData.options)
    .replaceAll('{{imageUrls}}', imageUrls)
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
