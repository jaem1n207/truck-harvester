import { load as loadHtml } from 'cheerio'

const PROXY_SERVICES = [
  // 무료 프록시 서비스들 (truck-no1.co.kr 차단 시 사용)
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors-anywhere.herokuapp.com/',
]

export async function proxyFetch(url: string, timeoutMs = 20000) {
  console.log(`[proxyFetch] Attempting proxy fetch for ${url}`)

  for (const [index, proxyBase] of PROXY_SERVICES.entries()) {
    console.log(`[proxyFetch] Trying proxy ${index + 1}: ${proxyBase}`)

    try {
      const proxyUrl = proxyBase + encodeURIComponent(url)
      const ctrl = new AbortController()
      const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)

      const res = await fetch(proxyUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        signal: ctrl.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        console.log(`[proxyFetch] Proxy ${index + 1} failed: ${res.status}`)
        continue
      }

      const text = await res.text()

      if (text.length < 500) {
        console.log(`[proxyFetch] Proxy ${index + 1} returned short content`)
        continue
      }

      console.log(
        `[proxyFetch] Proxy ${index + 1} succeeded, length: ${text.length}`
      )
      return loadHtml(text)
    } catch (e) {
      console.log(`[proxyFetch] Proxy ${index + 1} error:`, e)
      continue
    }
  }

  throw new Error('All proxy services failed')
}
