export interface UrlValidationResult {
  url: string
  isValid: boolean
  isDuplicate: boolean
  error?: string
}

export const validateUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url.trim())
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

export const validateUrlsFromText = (text: string): UrlValidationResult[] => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const seenUrls = new Set<string>()
  
  return lines.map(line => {
    const url = line
    const isValid = validateUrl(url)
    const normalizedUrl = url.toLowerCase()
    const isDuplicate = seenUrls.has(normalizedUrl)
    
    if (isValid && !isDuplicate) {
      seenUrls.add(normalizedUrl)
    }
    
    let error: string | undefined
    if (!isValid) {
      error = '유효하지 않은 URL 형식입니다.'
    } else if (isDuplicate) {
      error = '중복된 URL입니다.'
    }
    
    return {
      url,
      isValid,
      isDuplicate,
      error
    }
  })
}

export const getValidUrls = (urlResults: UrlValidationResult[]): string[] => {
  return urlResults
    .filter(result => result.isValid && !result.isDuplicate)
    .map(result => result.url)
}