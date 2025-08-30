import { load as loadHtml } from 'cheerio'

export async function fetchHtml(url: string, timeoutMs = 10000) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), timeoutMs)

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    cache: 'no-store',
    signal: ctrl.signal,
  }).catch((e) => {
    throw new Error(`HTTP fetch failed: ${e}`)
  })

  clearTimeout(id)

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const text = await res.text()

  // 더 보수적인 차단/봇페이지 휴리스틱 - Cloudflare 관련만 체크
  if (
    /cloudflare.*challenge|checking your browser|ray id:|cf-ray/i.test(text)
  ) {
    throw new Error('Blocked or challenge page detected')
  }

  return loadHtml(text)
}
