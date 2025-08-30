import { load as loadHtml } from 'cheerio'

export async function fetchHtml(url: string, timeoutMs = 10000) {
  const isProduction = process.env.NODE_ENV === 'production'
  const actualTimeout = isProduction
    ? Math.max(timeoutMs * 1.5, 8000)
    : timeoutMs

  console.log(`[fetchHtml] Starting fetch for ${url}`)
  console.log(
    `[fetchHtml] Environment: ${isProduction ? 'production' : 'development'}`
  )
  console.log(`[fetchHtml] Timeout: ${actualTimeout}ms`)

  let lastError = new Error('All attempts failed')
  const maxRetries = isProduction ? 2 : 1

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`[fetchHtml] Attempt ${attempt + 1}/${maxRetries}`)

    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log(
        `[fetchHtml] Timeout ${actualTimeout}ms exceeded, aborting...`
      )
      ctrl.abort()
    }, actualTimeout)

    const startTime = Date.now()

    try {
      console.log(`[fetchHtml] Starting fetch request...`)

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        cache: 'no-store',
        signal: ctrl.signal,
      })

      clearTimeout(timeoutId)
      const fetchTime = Date.now() - startTime
      console.log(`[fetchHtml] Fetch completed in ${fetchTime}ms`)
      console.log(
        `[fetchHtml] Response status: ${res.status} ${res.statusText}`
      )
      console.log(
        `[fetchHtml] Response headers:`,
        Object.fromEntries(res.headers.entries())
      )

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

      console.log(`[fetchHtml] Reading response body...`)
      const text = await res.text()
      const totalTime = Date.now() - startTime
      console.log(
        `[fetchHtml] Body read in ${totalTime}ms, length: ${text.length}`
      )

      // 더 보수적인 차단/봇페이지 휴리스틱
      if (
        /cloudflare.*challenge|checking your browser|ray id:|cf-ray/i.test(
          text
        ) ||
        /access.*denied|blocked|forbidden|지역.*제한|해외.*접속.*차단/i.test(
          text
        ) ||
        text.length < 500 // 너무 짧은 응답은 차단 페이지일 가능성
      ) {
        console.log(`[fetchHtml] Blocked/challenge page detected`)
        throw new Error('Blocked or challenge page detected')
      }

      console.log(`[fetchHtml] Successfully fetched and parsed HTML`)
      return loadHtml(text)
    } catch (e) {
      clearTimeout(timeoutId)
      const totalTime = Date.now() - startTime
      console.log(
        `[fetchHtml] Attempt ${attempt + 1} failed after ${totalTime}ms:`,
        e
      )

      lastError = new Error(`HTTP fetch failed: ${e}`)

      // 마지막 시도가 아니면 잠시 대기 후 재시도
      if (attempt < maxRetries - 1) {
        console.log(`[fetchHtml] Waiting 1s before retry...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  console.log(`[fetchHtml] All attempts failed, throwing error`)
  throw lastError
}
