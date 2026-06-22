import { load } from 'cheerio'

const allowedCheckPaperHosts = new Set([
  'autocafe.co.kr',
  'checkpaper.jmenetworks.co.kr',
])

export function isAllowedCheckPaperUrl(value: string) {
  try {
    const url = new URL(value)

    return (
      /^https?:$/.test(url.protocol) && allowedCheckPaperHosts.has(url.hostname)
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

export function rewriteCheckPaperHtml(html: string, finalUrl: string) {
  const $ = load(html)

  $('link[href], script[src], img[src]').each((_, element) => {
    const node = $(element)
    const attrName = node.attr('href') ? 'href' : 'src'
    const attrValue = node.attr(attrName)

    if (!attrValue || attrValue.startsWith('data:')) {
      return
    }

    node.attr(attrName, toCheckPaperAssetProxyUrl(attrValue, finalUrl))
  })

  $('#print').remove()
  $('a[href*="get.adobe.com"]').remove()

  $('head').prepend(`<base href="${finalUrl}">`)

  return $.html()
}
