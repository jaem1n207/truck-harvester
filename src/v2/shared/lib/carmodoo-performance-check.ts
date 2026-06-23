export const CARMODOO_RENDER_MAX_PAGE_COUNT = 4

export type CarmodooNativeRenderResponse = {
  images: string[]
}

export function isCarmodooPrintUrl(url: URL) {
  return (
    url.hostname === 'ck.carmodoo.com' &&
    url.pathname.toLowerCase() === '/carcheck/carmodooprint.do' &&
    Boolean(url.searchParams.get('checkNum')?.trim())
  )
}

function assertValidBase64(value: string) {
  const hasValidAlphabet = /^[A-Za-z0-9+/]*={0,2}$/.test(value)

  if (!hasValidAlphabet || value.length % 4 !== 0 || /=[^=]/.test(value)) {
    throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
  }
}

function decodeBase64ToBytes(value: string) {
  assertValidBase64(value)

  let bytes: Uint8Array

  if (typeof Buffer !== 'undefined') {
    bytes = new Uint8Array(Buffer.from(value, 'base64'))
  } else {
    try {
      const binary = atob(value)

      bytes = new Uint8Array(binary.length)

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
    } catch {
      throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
    }
  }

  if (bytes.length === 0) {
    throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
  }

  return bytes
}

export function decodeCarmodooNativeRenderResponse(
  value: unknown
): Uint8Array[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('images' in value) ||
    !Array.isArray(value.images)
  ) {
    throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
  }

  if (
    value.images.length === 0 ||
    value.images.length > CARMODOO_RENDER_MAX_PAGE_COUNT
  ) {
    throw new Error('성능점검기록부 이미지 수가 올바르지 않습니다.')
  }

  if (
    !value.images.every((image): image is string => typeof image === 'string')
  ) {
    throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
  }

  return value.images.map(decodeBase64ToBytes)
}
