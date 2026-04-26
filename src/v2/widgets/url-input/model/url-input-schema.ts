import { normalizeTruckUrl } from '@/v2/entities/url'
import { v2Copy } from '@/v2/shared/lib/copy'

export interface UrlInputSuccess {
  success: true
  urls: string[]
}

export interface UrlInputFailure {
  success: false
  message: string
}

export type UrlInputResult = UrlInputSuccess | UrlInputFailure

const splitAddressLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

export function parseUrlInputText(value: string): UrlInputResult {
  const rawUrls = splitAddressLines(value)

  if (rawUrls.length === 0) {
    return {
      success: false,
      message: v2Copy.urlInput.errors.empty,
    }
  }

  try {
    return {
      success: true,
      urls: Array.from(new Set(rawUrls.map((url) => normalizeTruckUrl(url)))),
    }
  } catch {
    return {
      success: false,
      message: v2Copy.urlInput.errors.invalid,
    }
  }
}
