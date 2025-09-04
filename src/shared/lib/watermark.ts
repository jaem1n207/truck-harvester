/**
 * 워터마크 처리 유틸리티
 * 이미지에 랜덤 워터마크를 하단에 추가하는 기능을 제공합니다.
 */

interface WatermarkOptions {
  opacity?: number
  scaleRatio?: number
}

const WATERMARK_IMAGES = [
  '/watermark-1.png',
  '/watermark-2.png',
  '/watermark-3.png',
  '/watermark-4.png',
  '/watermark-5.png',
]

/**
 * 이미지 URL에서 Image 객체를 로드합니다.
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Blob URL에서 Image 객체를 로드합니다.
 */
const loadImageFromBlob = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image from blob'))
    }
    img.src = url
  })
}

/**
 * 원본 이미지에 워터마크를 추가합니다.
 */
const applyWatermark = async (
  originalImage: HTMLImageElement,
  watermarkImage: HTMLImageElement,
  options: WatermarkOptions = {}
): Promise<Blob> => {
  const { opacity = 0.8, scaleRatio = 0.8 } = options

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  // Canvas 크기를 원본 이미지 크기로 설정
  canvas.width = originalImage.width
  canvas.height = originalImage.height

  // 원본 이미지 그리기
  ctx.drawImage(originalImage, 0, 0)

  // 워터마크 크기 계산 (원본 이미지 너비의 scaleRatio만큼)
  const watermarkWidth = originalImage.width * scaleRatio
  const watermarkHeight =
    (watermarkImage.height / watermarkImage.width) * watermarkWidth

  // 워터마크 위치 계산 (하단 중앙)
  const watermarkX = (originalImage.width - watermarkWidth) / 2
  const watermarkY = originalImage.height - watermarkHeight - 20 // 하단에서 20px 여백

  // 워터마크 투명도 설정
  ctx.globalAlpha = opacity

  // 워터마크 그리기
  ctx.drawImage(
    watermarkImage,
    watermarkX,
    watermarkY,
    watermarkWidth,
    watermarkHeight
  )

  // 투명도 복원
  ctx.globalAlpha = 1.0

  // Canvas를 Blob으로 변환
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to blob'))
        }
      },
      'image/jpeg',
      0.9
    )
  })
}

/**
 * 랜덤하게 워터마크 이미지를 선택합니다.
 */
const getRandomWatermarkPath = (): string => {
  const randomIndex = Math.floor(Math.random() * WATERMARK_IMAGES.length)
  return WATERMARK_IMAGES[randomIndex]
}

/**
 * 이미지 URL에서 이미지를 다운로드하고 워터마크를 추가합니다.
 */
export const addWatermarkToImage = async (
  imageUrl: string,
  options: WatermarkOptions = {},
  abortSignal?: AbortSignal
): Promise<Blob> => {
  try {
    // 취소 신호 확인
    if (abortSignal?.aborted) {
      throw new Error('Operation was aborted')
    }

    // 원본 이미지 다운로드
    const imageResponse = await fetch(imageUrl, {
      signal: abortSignal,
      mode: 'cors',
    })

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`)
    }

    const imageBlob = await imageResponse.blob()

    // 취소 신호 재확인
    if (abortSignal?.aborted) {
      throw new Error('Operation was aborted')
    }

    // 원본 이미지 로드
    const originalImage = await loadImageFromBlob(imageBlob)

    // 랜덤 워터마크 선택 및 로드
    const watermarkPath = getRandomWatermarkPath()
    const watermarkImage = await loadImage(watermarkPath)

    // 워터마크 적용
    const watermarkedBlob = await applyWatermark(
      originalImage,
      watermarkImage,
      options
    )

    return watermarkedBlob
  } catch (error) {
    // 에러 발생 시 원본 이미지 반환 (fallback)
    console.warn(
      'Watermark processing failed, falling back to original image:',
      error
    )

    try {
      const fallbackResponse = await fetch(imageUrl, {
        signal: abortSignal,
        mode: 'cors',
      })

      if (fallbackResponse.ok) {
        return await fallbackResponse.blob()
      }
    } catch (fallbackError) {
      console.error('Fallback image fetch also failed:', fallbackError)
    }

    throw error
  }
}

/**
 * 이미지 Blob에 워터마크를 추가합니다.
 */
export const addWatermarkToBlob = async (
  imageBlob: Blob,
  options: WatermarkOptions = {}
): Promise<Blob> => {
  try {
    // 원본 이미지 로드
    const originalImage = await loadImageFromBlob(imageBlob)

    // 랜덤 워터마크 선택 및 로드
    const watermarkPath = getRandomWatermarkPath()
    const watermarkImage = await loadImage(watermarkPath)

    // 워터마크 적용
    const watermarkedBlob = await applyWatermark(
      originalImage,
      watermarkImage,
      options
    )

    return watermarkedBlob
  } catch (error) {
    // 에러 발생 시 원본 Blob 반환 (fallback)
    console.warn(
      'Watermark processing failed, falling back to original blob:',
      error
    )
    return imageBlob
  }
}
