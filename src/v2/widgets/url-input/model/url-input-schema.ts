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

const supportedTruckUrlPattern =
  /https?:\/\/www\.truck-no1\.co\.kr\/model\/DetailView\.asp\?[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi
const trailingChatPunctuationPattern = /[.,)\]}]+$/g

const stripTrailingChatPunctuation = (value: string) =>
  value.replace(trailingChatPunctuationPattern, '')

export function extractTruckUrlsFromText(value: string): string[] {
  const normalizedUrls = new Set<string>()
  const matches = value.match(supportedTruckUrlPattern) ?? []

  for (const match of matches) {
    try {
      normalizedUrls.add(normalizeTruckUrl(stripTrailingChatPunctuation(match)))
    } catch {
      continue
    }
  }

  return Array.from(normalizedUrls)
}

export function parseUrlInputText(value: string): UrlInputResult {
  if (value.trim().length === 0) {
    return {
      success: false,
      message: v2Copy.urlInput.errors.empty,
    }
  }

  const urls = extractTruckUrlsFromText(value)

  if (urls.length === 0) {
    return {
      success: false,
      message: v2Copy.urlInput.errors.invalid,
    }
  }

  return {
    success: true,
    urls,
  }
}
