import { load as loadHtml } from 'cheerio'

export async function fetchHtml(url: string, timeoutMs = 10000) {
  const isProduction = process.env.NODE_ENV === 'production'
  const actualTimeout = isProduction
    ? Math.min(timeoutMs, 8000) // 프로덕션에서 최대 8초로 제한
    : timeoutMs

  console.log(`[fetchHtml] Fetching ${url} (${actualTimeout}ms timeout)`)

  let lastError = new Error('All attempts failed')
  const maxRetries = 1 // 재시도 제거로 속도 향상

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
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          DNT: '1',
          Pragma: 'no-cache',
          'Sec-Ch-Ua':
            '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        cache: 'no-store',
        signal: ctrl.signal,
      })

      clearTimeout(timeoutId)
      const fetchTime = Date.now() - startTime
      console.log(`[fetchHtml] Response: ${res.status} in ${fetchTime}ms`)

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

      const text = await res.text()
      const totalTime = Date.now() - startTime
      console.log(
        `[fetchHtml] Completed in ${totalTime}ms, ${text.length} chars`
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

      return loadHtml(text)
    } catch (e) {
      clearTimeout(timeoutId)
      const totalTime = Date.now() - startTime
      console.log(
        `[fetchHtml] Attempt ${attempt + 1} failed after ${totalTime}ms:`,
        e
      )

      lastError = new Error(`HTTP fetch failed: ${e}`)
    }
  }

  console.log(`[fetchHtml] All attempts failed, throwing error`)
  throw lastError
}
