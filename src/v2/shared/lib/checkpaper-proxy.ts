import { load } from 'cheerio'

const allowedCheckPaperHosts = new Set([
  'autocafe.co.kr',
  'checkpaper.jmenetworks.co.kr',
])

const MAX_CHECKPAPER_REDIRECTS = 4
export const CHECKPAPER_FETCH_TIMEOUT_MS = 4500

export type CheckPaperTimeoutBudget = {
  getRemainingMs: () => number
}

export function createTimeoutBudget(
  totalMs: number = CHECKPAPER_FETCH_TIMEOUT_MS
): CheckPaperTimeoutBudget {
  const deadline = Date.now() + totalMs

  return {
    getRemainingMs() {
      return Math.max(0, deadline - Date.now())
    },
  }
}

export function isAllowedCheckPaperUrl(value: string) {
  try {
    const url = new URL(value)

    return (
      /^https?:$/i.test(url.protocol) &&
      allowedCheckPaperHosts.has(url.hostname)
    )
  } catch {
    return false
  }
}

export function toCheckPaperAssetProxyUrl(
  assetUrl: string,
  baseUrl: string,
  proxyPath = '/api/v2/checkpaper/asset'
) {
  const absoluteUrl = new URL(assetUrl, baseUrl).toString()

  return `${proxyPath}?url=${encodeURIComponent(absoluteUrl)}`
}

function isDisallowedUrlScheme(value: string) {
  return /^(javascript:|data:|blob:|about:)/i.test(value.trim())
}

function toProxiedAssetUrl(rawUrl: string, baseUrl: string) {
  const trimmed = rawUrl.trim()

  if (!trimmed || isDisallowedUrlScheme(trimmed) || trimmed.startsWith('#')) {
    return '#'
  }

  try {
    const absoluteUrl = new URL(trimmed, baseUrl).toString()

    if (!isAllowedCheckPaperUrl(absoluteUrl)) {
      return null
    }

    return toCheckPaperAssetProxyUrl(absoluteUrl, baseUrl)
  } catch {
    return null
  }
}

function sanitizeActionAttribute(rawAction: string, baseUrl: string) {
  const trimmed = rawAction.trim()

  if (!trimmed || isDisallowedUrlScheme(trimmed)) {
    return '#'
  }

  if (/^\/\//.test(trimmed)) {
    return '#'
  }

  if (!/^(https?:\/\/)/i.test(trimmed) && /^(https?:)/i.test(trimmed)) {
    return '#'
  }

  try {
    const actionUrl = new URL(trimmed, baseUrl)

    if (!/^(https?:)$/i.test(actionUrl.protocol)) {
      return '#'
    }

    if (!isAllowedCheckPaperUrl(actionUrl.toString())) {
      return '#'
    }
  } catch {
    return '#'
  }

  return trimmed
}

function createTimeoutError() {
  return new DOMException(
    'CheckPaper response body read timed out',
    'TimeoutError'
  )
}

async function readWithTimeoutFromReader<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  readBuffer: (chunks: Uint8Array[]) => T
) {
  const chunks: Uint8Array[] = []
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      void reader.cancel()
      reject(createTimeoutError())
    }, timeoutMs)
  })

  try {
    while (true) {
      const chunkOrTimeout = (await Promise.race([reader.read(), timeout])) as
        | ReadableStreamReadResult<Uint8Array>
        | typeof timeout

      if (timedOut) {
        throw createTimeoutError()
      }

      if ('done' in chunkOrTimeout) {
        if (chunkOrTimeout.done) {
          return readBuffer(chunks)
        }

        chunks.push(chunkOrTimeout.value ?? new Uint8Array())
      }
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export async function readResponseTextWithTimeout(
  response: Response,
  timeoutMs = CHECKPAPER_FETCH_TIMEOUT_MS
): Promise<string> {
  if (!response.body) {
    return response.text()
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  return readWithTimeoutFromReader(reader, timeoutMs, (chunks) => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Uint8Array(totalLength)

    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    return decoder.decode(merged)
  })
}

export async function readResponseArrayBufferWithTimeout(
  response: Response,
  timeoutMs = CHECKPAPER_FETCH_TIMEOUT_MS
): Promise<ArrayBuffer> {
  if (!response.body) {
    const fallback = await response.arrayBuffer()
    return fallback
  }

  const reader = response.body.getReader()

  return readWithTimeoutFromReader(reader, timeoutMs, (chunks) => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Uint8Array(totalLength)

    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    return merged.buffer.slice(0, merged.byteLength)
  })
}

export function rewriteCheckPaperHtml(html: string, finalUrl: string) {
  const $ = load(html)
  const baseUrl = new URL(finalUrl).toString()

  $('script').remove()
  $('*').each((_, element) => {
    const node = $(element)
    const attrs = node.attr() || {}

    Object.keys(attrs).forEach((name) => {
      if (/^on/i.test(name)) {
        node.removeAttr(name)
      }
    })
  })

  $('a[href*="get.adobe.com"]').remove()

  $('[href],[src],[action]').each((_, element) => {
    const node = $(element)

    const href = node.attr('href')
    if (href !== undefined) {
      const rewrittenHref = toProxiedAssetUrl(href, baseUrl)

      if (rewrittenHref === null) {
        node.removeAttr('href')
      } else {
        node.attr('href', rewrittenHref)
      }
    }

    const src = node.attr('src')
    if (src !== undefined) {
      const rewrittenSrc = toProxiedAssetUrl(src, baseUrl)

      if (rewrittenSrc === null) {
        node.removeAttr('src')
      } else {
        node.attr('src', rewrittenSrc)
      }
    }

    const action = node.attr('action')
    if (action !== undefined) {
      node.attr('action', sanitizeActionAttribute(action, baseUrl))
    }
  })

  $('#print').remove()

  $('base').remove()

  const base = $('<base>')
  base.attr('href', baseUrl)
  const head = $('head')
  if (head.length > 0) {
    head.prepend(base)
  }

  return $.html()
}

function toProxiedCssAsset(rawUrl: string, finalUrl: string) {
  const trimmed = rawUrl.trim()

  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  if (/^data:|^blob:|^about:/i.test(trimmed)) {
    return null
  }

  if (trimmed.includes('/api/v2/checkpaper/asset?url=')) {
    return null
  }

  if (/^\/\//.test(trimmed) || /^(?!https?:)\w+:/.test(trimmed)) {
    return null
  }

  try {
    const absoluteUrl = new URL(trimmed, finalUrl).toString()

    if (!isAllowedCheckPaperUrl(absoluteUrl)) {
      return null
    }

    return toCheckPaperAssetProxyUrl(absoluteUrl, finalUrl)
  } catch {
    return null
  }
}

export function rewriteCheckPaperCss(css: string, finalUrl: string) {
  const baseUrl = new URL(finalUrl).toString()

  const withUrlRefs = css.replace(
    /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
    (match, _quote, rawUrl) => {
      const rewritten = toProxiedCssAsset(rawUrl, baseUrl)

      if (!rewritten) {
        return match
      }

      return `url("${rewritten}")`
    }
  )

  return withUrlRefs.replace(/@import\s+([^;]*);/gi, (match, importBody) => {
    const rawImport = importBody.trim()

    const urlMatch = rawImport.match(/^url\(\s*(['"]?)(.*?)\1\s*\)([\s\S]*)$/i)
    if (urlMatch) {
      const candidate = urlMatch[2].trim()
      const mediaClause = urlMatch[3] ?? ''
      const rewritten = toProxiedCssAsset(candidate, baseUrl)

      if (!rewritten) {
        return match
      }

      return `@import url("${rewritten}")${mediaClause};`
    }

    const quotedMatch = rawImport.match(/^(['"])(.*?)\1([\s\S]*)$/i)
    if (!quotedMatch) {
      return match
    }

    const candidate = quotedMatch[2].trim()
    const mediaClause = quotedMatch[3] ?? ''
    const rewritten = toProxiedCssAsset(candidate, baseUrl)

    if (!rewritten) {
      return match
    }

    return `@import url("${rewritten}")${mediaClause};`
  })
}

type RedirectError = Error & {
  code: 'UNSAFE_REDIRECT' | 'REDIRECT_LIMIT_REACHED' | 'BUDGET_EXCEEDED'
}

function createRedirectError(code: RedirectError['code']) {
  const error = new Error(
    `CheckPaper redirect blocked: ${code}`
  ) as RedirectError

  error.code = code

  return error
}

export async function fetchWithManualRedirect(
  initialUrl: string,
  headers: HeadersInit,
  timeoutBudget: CheckPaperTimeoutBudget = createTimeoutBudget(),
  maxRedirects = MAX_CHECKPAPER_REDIRECTS
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = new URL(initialUrl).toString()

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const timeoutMs = timeoutBudget.getRemainingMs()
    if (timeoutMs <= 0) {
      throw createRedirectError('BUDGET_EXCEEDED')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch(currentUrl, {
        cache: 'no-store',
        redirect: 'manual',
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.status >= 300 && response.status < 400) {
        if (redirectCount === maxRedirects) {
          throw createRedirectError('REDIRECT_LIMIT_REACHED')
        }

        const location = response.headers.get('location')
        if (!location) {
          throw createRedirectError('REDIRECT_LIMIT_REACHED')
        }

        const nextUrl = new URL(location, currentUrl).toString()

        if (!isAllowedCheckPaperUrl(nextUrl)) {
          throw createRedirectError('UNSAFE_REDIRECT')
        }

        currentUrl = nextUrl

        continue
      }

      return { response, finalUrl: currentUrl }
    } catch (error) {
      clearTimeout(timeout)
      throw error
    }
  }

  throw createRedirectError('REDIRECT_LIMIT_REACHED')
}
