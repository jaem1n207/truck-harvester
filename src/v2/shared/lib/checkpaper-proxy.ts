import { request as requestHttps } from 'node:https'
import { rootCertificates } from 'node:tls'

import { load } from 'cheerio'

const MAX_CHECKPAPER_REDIRECTS = 4
const MAX_CHECKPAPER_URL_LENGTH = 4096
const CHECKPAPER_ASSET_PROXY_PATH = '/api/v2/checkpaper/asset'
const SAME_ORIGIN_PROXY_URL_BASE = 'https://truck-harvester.local'
export const CHECKPAPER_FETCH_TIMEOUT_MS = 4500

const autocafeHostname = 'autocafe.co.kr'

const incompleteCertificateChainErrorCodes = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

/*
 * autocafe.co.kr currently serves only its leaf certificate. Node does not
 * fetch the missing AIA intermediate automatically, so its otherwise valid
 * certificate cannot be verified in Vercel's Node runtime.
 *
 * Source: leaf Authority Information Access URL
 * Subject: GoGetSSL RSA DV CA
 * SHA-256: 43:CA:C3:1E:F8:E8:BA:1B:4B:16:B8:20:6E:4C:0A:26:
 *          C5:BA:DB:2F:C3:AA:09:E9:01:70:E4:1B:66:C2:FD:64
 * Valid through: 2028-09-05
 */
const goGetSslRsaDvCa = `-----BEGIN CERTIFICATE-----
MIIF1zCCA7+gAwIBAgIRAJOLsI5imHtPdfmMtqUEXJYwDQYJKoZIhvcNAQEMBQAw
gYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpOZXcgSmVyc2V5MRQwEgYDVQQHEwtK
ZXJzZXkgQ2l0eTEeMBwGA1UEChMVVGhlIFVTRVJUUlVTVCBOZXR3b3JrMS4wLAYD
VQQDEyVVU0VSVHJ1c3QgUlNBIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MB4XDTE4
MDkwNjAwMDAwMFoXDTI4MDkwNTIzNTk1OVowTDELMAkGA1UEBhMCTFYxDTALBgNV
BAcTBFJpZ2ExETAPBgNVBAoTCEdvR2V0U1NMMRswGQYDVQQDExJHb0dldFNTTCBS
U0EgRFYgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCfwF4hD6E1
kLglXs1n2fH5vMQukCGyyD4LqLsc3pSzeh8we7njU4TB85BH5YXqcfwiH1Sf78aB
hk1FgXoAZ3EQrF49We8mnTtTPFRnMwEHLJRpY9I/+peKeAZNL0MJG5zM+9gmcSpI
OTI6p7MPela72g0pBQjwcExYLqFFVsnroEPTRRlmfTBTRi9r7rYcXwIct2VUCRmj
jR1GX13op370YjYwgGv/TeYqUWkNiEjWNskFDEfxSc0YfoBwwKdPNfp6t/5+RsFn
lgQKstmFLQbbENsdUEpzWEvZUpDC4qPvRrxEKcF0uLoZhEnxhskwXSTC64BNtc+l
VEk7/g/be8svAgMBAAGjggF1MIIBcTAfBgNVHSMEGDAWgBRTeb9aqitKz1SA4dib
wJ3ysgNmyzAdBgNVHQ4EFgQU+ftQxItnu2dk/oMhpqnOP1WEk5kwDgYDVR0PAQH/
BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYIKwYBBQUHAwEG
CCsGAQUFBwMCMCIGA1UdIAQbMBkwDQYLKwYBBAGyMQECAkAwCAYGZ4EMAQIBMFAG
A1UdHwRJMEcwRaBDoEGGP2h0dHA6Ly9jcmwudXNlcnRydXN0LmNvbS9VU0VSVHJ1
c3RSU0FDZXJ0aWZpY2F0aW9uQXV0aG9yaXR5LmNybDB2BggrBgEFBQcBAQRqMGgw
PwYIKwYBBQUHMAKGM2h0dHA6Ly9jcnQudXNlcnRydXN0LmNvbS9VU0VSVHJ1c3RS
U0FBZGRUcnVzdENBLmNydDAlBggrBgEFBQcwAYYZaHR0cDovL29jc3AudXNlcnRy
dXN0LmNvbTANBgkqhkiG9w0BAQwFAAOCAgEAXXRDKHiA5DOhNKsztwayc8qtlK4q
Vt2XNdlzXn4RyZIsC9+SBi0Xd4vGDhFx6XX4N/fnxlUjdzNN/BYY1gS1xK66Uy3p
rw9qI8X12J4er9lNNhrsvOcjB8CT8FyvFu94j3Bs427uxcSukhYbERBAIN7MpWKl
VWxT3q8GIqiEYVKa/tfWAvnOMDDSKgRwMUtggr/IE77hekQm20p7e1BuJODf1Q7c
FPt7T74m3chg+qu0xheLI6HsUFuOxc7R5SQlkFvaVY5tmswfWpY+rwhyJW+FWNbT
uNXkxR4v5KOQPWrY100/QN68/j17paKuSXNcsr56snuB/Dx+MACLBdsF35HxPadx
78vkfQ37WcVmKZtHrHJQ/QUyjxdG8fezMsh0f+puUln/O+NlsFtipve8qYa9h/K5
yD0oZN93ChWve78XrV4vCpjO75Nk5B8O9CWQqGTHbhkgvjyb9v/B+sYJqB22/NLl
R4RPvbmqDJGeEI+4u6NJ5YiLIVVsX+dyfFP8zUbSsj6J34RyCYKBbQ4L+r7k8Srs
LY51WUFP292wkFDPSDmV7XsUNTDOZoQcBh2Fycf7xFfxeA+6ERx2d8MpPPND7yS2
1dkf+SY5SdpSbAKtYmbqb9q8cZUDEImNWJFUVHBLDOrnYhGwJudE3OBXRTxNhMDm
IXnjEeWrFvAZQhk=
-----END CERTIFICATE-----`

const trustedAutocafeCaCertificates = [...rootCertificates, goGetSslRsaDvCa]

export type CheckPaperTimeoutBudget = {
  getRemainingMs: () => number
}

type CheckPaperFetch = (input: string, init: RequestInit) => Promise<Response>

type AutocafeTrustedChainFetch = (
  url: string,
  init: {
    headers: HeadersInit
    signal: AbortSignal
  }
) => Promise<Response>

interface CheckPaperFetchDependencies {
  fetch?: CheckPaperFetch
  fetchAutocafeWithTrustedChain?: AutocafeTrustedChainFetch
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
  return toAllowedCheckPaperRequestUrl(value) !== undefined
}

function isAllowedCheckPaperPath(hostname: string, pathname: string) {
  const normalizedPath = pathname.toLowerCase()

  if (hostname === autocafeHostname) {
    return (
      normalizedPath === '/asso/carcheck_form_my.asp' ||
      normalizedPath === '/asso/carcheck_form.asp'
    )
  }

  if (hostname === 'checkpaper.jmenetworks.co.kr') {
    return [
      '/assets/',
      '/carimage/',
      '/images/',
      '/service/',
      '/theme/',
      '/view/',
    ].some((prefix) => normalizedPath.startsWith(prefix))
  }

  if (hostname === 'ck.carmodoo.com') {
    return ['/carcheck/', '/css/', '/data/', '/images/', '/js/'].some(
      (prefix) => normalizedPath.startsWith(prefix)
    )
  }

  return false
}

function selectAllowedCheckPaperOrigin(url: URL) {
  if (url.username || url.password || url.port || url.hash) {
    return undefined
  }

  if (!isAllowedCheckPaperPath(url.hostname, url.pathname)) {
    return undefined
  }

  if (url.hostname === autocafeHostname) {
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return 'https://autocafe.co.kr'
    }

    return undefined
  }

  if (
    url.hostname === 'checkpaper.jmenetworks.co.kr' &&
    url.protocol === 'https:'
  ) {
    return 'https://checkpaper.jmenetworks.co.kr'
  }

  if (url.hostname === 'ck.carmodoo.com' && url.protocol === 'https:') {
    return 'https://ck.carmodoo.com'
  }

  return undefined
}

function encodePathname(pathname: string) {
  const encodedSegments: string[] = []

  for (const segment of pathname.split('/')) {
    let decodedSegment = segment

    for (let depth = 0; depth < 3; depth += 1) {
      let nextDecodedSegment: string

      try {
        nextDecodedSegment = decodeURIComponent(decodedSegment)
      } catch {
        return undefined
      }

      if (nextDecodedSegment === decodedSegment) {
        break
      }

      decodedSegment = nextDecodedSegment
    }

    if (
      decodedSegment === '.' ||
      decodedSegment === '..' ||
      decodedSegment.includes('/') ||
      decodedSegment.includes('\\')
    ) {
      return undefined
    }

    encodedSegments.push(encodeURIComponent(decodedSegment))
  }

  const encodedPathname = encodedSegments.join('/')

  if (!encodedPathname.startsWith('/') || encodedPathname.startsWith('//')) {
    return undefined
  }

  return encodedPathname
}

function encodeSearchParams(searchParams: URLSearchParams) {
  const encodedEntries: string[] = []

  searchParams.forEach((value, key) => {
    encodedEntries.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
  })

  return encodedEntries.length > 0 ? `?${encodedEntries.join('&')}` : ''
}

function toAllowedCheckPaperRequestUrl(value: string) {
  if (value.length > MAX_CHECKPAPER_URL_LENGTH) {
    return undefined
  }

  try {
    const url = new URL(value)
    const allowedOrigin = selectAllowedCheckPaperOrigin(url)
    const encodedPathname = encodePathname(url.pathname)

    if (!allowedOrigin || !encodedPathname) {
      return undefined
    }

    return `${allowedOrigin}${encodedPathname}${encodeSearchParams(
      url.searchParams
    )}`
  } catch {
    return undefined
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIncompleteCertificateChainError(error: unknown) {
  let current = error

  for (let depth = 0; depth < 5 && isObject(current); depth += 1) {
    if (
      typeof current.code === 'string' &&
      incompleteCertificateChainErrorCodes.has(current.code)
    ) {
      return true
    }

    current = current.cause
  }

  return false
}

function shouldRecoverAutocafeCertificateChain(url: string, error: unknown) {
  const parsedUrl = new URL(url)

  return (
    parsedUrl.protocol === 'https:' &&
    parsedUrl.hostname === autocafeHostname &&
    isIncompleteCertificateChainError(error)
  )
}

function toResponseHeaders(headers: import('node:http').IncomingHttpHeaders) {
  const responseHeaders = new Headers()

  Object.entries(headers).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => responseHeaders.append(name, item))
      return
    }

    if (value !== undefined) {
      responseHeaders.set(name, value)
    }
  })

  return responseHeaders
}

function fetchAutocafeWithTrustedChain(
  url: string,
  { headers, signal }: { headers: HeadersInit; signal: AbortSignal }
): Promise<Response> {
  const parsedUrl = new URL(url)

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== autocafeHostname
  ) {
    return Promise.reject(new Error('Unsupported trusted-chain host'))
  }

  return new Promise((resolve, reject) => {
    const request = requestHttps(
      parsedUrl,
      {
        ca: trustedAutocafeCaCertificates,
        headers: {
          ...Object.fromEntries(new Headers(headers).entries()),
          'Accept-Encoding': 'identity',
        },
        rejectUnauthorized: true,
        signal,
      },
      (response) => {
        const chunks: Buffer[] = []

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        response.on('end', () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              headers: toResponseHeaders(response.headers),
              status: response.statusCode ?? 502,
              statusText: response.statusMessage,
            })
          )
        })
        response.on('error', reject)
        response.on('aborted', () => {
          reject(new Error('Autocafe response aborted'))
        })
      }
    )

    request.on('error', reject)
    request.end()
  })
}

export function toCheckPaperAssetProxyUrl(
  assetUrl: string,
  baseUrl: string,
  proxyPath = CHECKPAPER_ASSET_PROXY_PATH
) {
  const absoluteUrl = new URL(assetUrl, baseUrl).toString()

  return `${proxyPath}?url=${encodeURIComponent(absoluteUrl)}`
}

function isDisallowedUrlScheme(value: string) {
  return /^(javascript:|data:|blob:|about:)/i.test(value.trim())
}

function getSafeAlreadyProxiedAssetUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed.includes(CHECKPAPER_ASSET_PROXY_PATH)) {
    return { kind: 'not-proxy' as const }
  }

  if (!trimmed.startsWith(`${CHECKPAPER_ASSET_PROXY_PATH}?`)) {
    return { kind: 'invalid-proxy' as const }
  }

  try {
    const proxyUrl = new URL(trimmed, SAME_ORIGIN_PROXY_URL_BASE)

    if (
      proxyUrl.origin !== SAME_ORIGIN_PROXY_URL_BASE ||
      proxyUrl.pathname !== CHECKPAPER_ASSET_PROXY_PATH
    ) {
      return { kind: 'invalid-proxy' as const }
    }

    const wrappedUrl = proxyUrl.searchParams.get('url')

    if (!wrappedUrl || !isAllowedCheckPaperUrl(wrappedUrl)) {
      return { kind: 'invalid-proxy' as const }
    }

    return { kind: 'safe-proxy' as const, url: trimmed }
  } catch {
    return { kind: 'invalid-proxy' as const }
  }
}

function toProxiedAssetUrl(rawUrl: string, baseUrl: string) {
  const trimmed = rawUrl.trim()

  if (!trimmed || isDisallowedUrlScheme(trimmed) || trimmed.startsWith('#')) {
    return '#'
  }

  const alreadyProxied = getSafeAlreadyProxiedAssetUrl(trimmed)
  if (alreadyProxied.kind === 'safe-proxy') {
    return alreadyProxied.url
  }
  if (alreadyProxied.kind === 'invalid-proxy') {
    return null
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

function parseJsonObjectLiteral(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    )
  } catch {
    return {}
  }
}

function isDigitFragment(value: string) {
  return /^\d+$/.test(value.trim())
}

function isSingleAlphabeticMarker(value: string) {
  return /^[a-z]$/i.test(value.trim())
}

function extractCarmodooSetData(
  scriptText: string,
  prefix: string
): Record<string, string> {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `setData\\(\\s*['"]${escapedPrefix}['"]\\s*,\\s*(['"])(.*?)\\1`,
    'gs'
  )
  const merged: Record<string, string> = {}

  for (const match of scriptText.matchAll(pattern)) {
    Object.assign(merged, parseJsonObjectLiteral(match[2] ?? '{}'))
  }

  return merged
}

function extractCarmodooVariableData(
  scriptText: string,
  variableName: string
): Record<string, string> {
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `var\\s+${escapedName}\\s*=\\s*(['"])(.*?)\\1\\s*;`,
    's'
  )
  const match = scriptText.match(pattern)

  return parseJsonObjectLiteral(match?.[2] ?? '{}')
}

function applyCarmodooCheckboxData(
  $: ReturnType<typeof load>,
  prefix: string,
  values: Record<string, string>
) {
  Object.entries(values).forEach(([key, value]) => {
    const normalizedKey = key.trim()
    const normalizedValue = value.trim()

    if (
      !isDigitFragment(normalizedKey) ||
      !isDigitFragment(normalizedValue) ||
      normalizedValue === '0'
    ) {
      return
    }

    $(`#${prefix}_${normalizedKey}_${normalizedValue}`).attr(
      'checked',
      'checked'
    )
  })
}

function applyCarmodooImageMarkerData({
  $,
  baseUrl,
  selectorPrefix,
  values,
}: {
  $: ReturnType<typeof load>
  baseUrl: string
  selectorPrefix: string
  values: Record<string, string>
}) {
  Object.entries(values).forEach(([key, value]) => {
    const normalizedKey = key.trim()
    const marker = value.trim().toLowerCase()

    if (!isDigitFragment(normalizedKey) || !isSingleAlphabeticMarker(marker)) {
      return
    }

    const proxiedIconUrl = toCheckPaperAssetProxyUrl(
      `/images/check/icon_${marker}.png`,
      baseUrl
    )
    const node = $(`${selectorPrefix}${normalizedKey}`)

    if (node.is('img')) {
      node.attr('src', proxiedIconUrl)
      node.attr('alt', value)
      return
    }

    const markerImage = $('<img>')
    markerImage.attr('src', proxiedIconUrl)
    markerImage.attr('alt', value)
    node.empty().append(markerImage)
  })
}

function applyCarmodooLiteralScriptData(
  $: ReturnType<typeof load>,
  baseUrl: string
) {
  if (new URL(baseUrl).hostname !== 'ck.carmodoo.com') {
    return
  }

  const scriptText = $('script')
    .toArray()
    .map((element) => $(element).text())
    .join('\n')

  ;['bc', 'mac', 'dc', 'eac'].forEach((prefix) => {
    applyCarmodooCheckboxData(
      $,
      prefix,
      extractCarmodooSetData(scriptText, prefix)
    )
  })

  applyCarmodooImageMarkerData({
    $,
    baseUrl,
    selectorPrefix: '#accout_',
    values: extractCarmodooVariableData(scriptText, 'ucAccOutCheck'),
  })
  applyCarmodooImageMarkerData({
    $,
    baseUrl,
    selectorPrefix: '#repair_wrap_data .c',
    values: extractCarmodooVariableData(scriptText, 'ucImgOnCheck'),
  })
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

  applyCarmodooLiteralScriptData($, baseUrl)

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

  const alreadyProxied = getSafeAlreadyProxiedAssetUrl(trimmed)
  if (alreadyProxied.kind === 'safe-proxy') {
    return alreadyProxied.url
  }
  if (alreadyProxied.kind === 'invalid-proxy') {
    return '#'
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
  maxRedirects = MAX_CHECKPAPER_REDIRECTS,
  dependencies: CheckPaperFetchDependencies = {}
): Promise<{ response: Response; finalUrl: string }> {
  const allowedInitialUrl = toAllowedCheckPaperRequestUrl(initialUrl)

  if (!allowedInitialUrl) {
    throw createRedirectError('UNSAFE_REDIRECT')
  }

  let currentUrl = allowedInitialUrl
  const regularFetch = dependencies.fetch ?? globalThis.fetch
  const trustedChainFetch =
    dependencies.fetchAutocafeWithTrustedChain ?? fetchAutocafeWithTrustedChain

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
      let response: Response

      try {
        response = await regularFetch(currentUrl, {
          cache: 'no-store',
          redirect: 'manual',
          headers,
          signal: controller.signal,
        })
      } catch (error) {
        if (
          controller.signal.aborted ||
          !shouldRecoverAutocafeCertificateChain(currentUrl, error)
        ) {
          throw error
        }

        response = await trustedChainFetch(currentUrl, {
          headers,
          signal: controller.signal,
        })
      }

      clearTimeout(timeout)

      if (response.status >= 300 && response.status < 400) {
        if (redirectCount === maxRedirects) {
          throw createRedirectError('REDIRECT_LIMIT_REACHED')
        }

        const location = response.headers.get('location')
        if (!location) {
          throw createRedirectError('REDIRECT_LIMIT_REACHED')
        }

        const nextUrl = toAllowedCheckPaperRequestUrl(
          new URL(location, currentUrl).toString()
        )

        if (!nextUrl) {
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
