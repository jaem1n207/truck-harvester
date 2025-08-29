export interface UrlValidationResult {
  url: string
  isValid: boolean
  isDuplicate: boolean
  error?: string
}

// 허용된 도메인 목록
const ALLOWED_DOMAINS = ['www.truck-no1.co.kr']

// 허용된 경로 패턴
const ALLOWED_PATHS = ['/model/DetailView.asp']

export const validateUrl = (
  url: string
): { isValid: boolean; error?: string } => {
  try {
    const urlObj = new URL(url.trim())

    // 프로토콜 검사
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return { isValid: false, error: 'HTTP 또는 HTTPS 프로토콜만 허용됩니다.' }
    }

    // 도메인 검사
    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      return {
        isValid: false,
        error: `허용되지 않은 도메인입니다. 허용된 도메인: ${ALLOWED_DOMAINS.join(', ')}`,
      }
    }

    // 경로 검사
    if (!ALLOWED_PATHS.some((path) => urlObj.pathname === path)) {
      return {
        isValid: false,
        error: `허용되지 않은 경로입니다. 허용된 경로: ${ALLOWED_PATHS.join(', ')}`,
      }
    }

    // 필수 쿼리 파라미터 검사 (DetailView.asp의 경우)
    if (urlObj.pathname === '/model/DetailView.asp') {
      const requiredParams = ['ShopNo', 'MemberNo', 'OnCarNo']
      const searchParams = urlObj.searchParams

      for (const param of requiredParams) {
        if (!searchParams.has(param)) {
          return {
            isValid: false,
            error: `필수 파라미터가 누락되었습니다: ${param}`,
          }
        }
      }
    }

    return { isValid: true }
  } catch {
    return { isValid: false, error: '유효하지 않은 URL 형식입니다.' }
  }
}

export const validateUrlsFromText = (text: string): UrlValidationResult[] => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const seenUrls = new Set<string>()

  return lines.map((line) => {
    const url = line
    const validationResult = validateUrl(url)
    const normalizedUrl = url.toLowerCase()
    const isDuplicate = seenUrls.has(normalizedUrl)

    if (validationResult.isValid && !isDuplicate) {
      seenUrls.add(normalizedUrl)
    }

    let error: string | undefined
    if (!validationResult.isValid) {
      error = validationResult.error || '유효하지 않은 URL입니다.'
    } else if (isDuplicate) {
      error = '중복된 URL입니다.'
    }

    return {
      url,
      isValid: validationResult.isValid,
      isDuplicate,
      error,
    }
  })
}

export const getValidUrls = (urlResults: UrlValidationResult[]): string[] => {
  return urlResults
    .filter((result) => result.isValid && !result.isDuplicate)
    .map((result) => result.url)
}
