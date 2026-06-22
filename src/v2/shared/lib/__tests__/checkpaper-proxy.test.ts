import { describe, expect, it } from 'vitest'

import {
  isAllowedCheckPaperUrl,
  rewriteCheckPaperHtml,
  toCheckPaperAssetProxyUrl,
} from '../checkpaper-proxy'

const finalUrl =
  'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107099659&print=0&iframe=1&key='

describe('checkpaper proxy helpers', () => {
  it('allows only the CheckPaper and autocafe hosts', () => {
    expect(isAllowedCheckPaperUrl(finalUrl)).toBe(true)
    expect(
      isAllowedCheckPaperUrl(
        'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3'
      )
    ).toBe(true)
    expect(isAllowedCheckPaperUrl('https://example.com/CheckPaper')).toBe(false)
    expect(
      isAllowedCheckPaperUrl(
        'ftp://checkpaper.jmenetworks.co.kr/Service/CheckPaper'
      )
    ).toBe(false)
  })

  it('builds encoded same-origin asset proxy URLs', () => {
    expect(
      toCheckPaperAssetProxyUrl('/assets/css/style_v2.css', finalUrl)
    ).toBe(
      `/api/v2/checkpaper/asset?url=${encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css'
      )}`
    )
  })

  it('rewrites stylesheet, script, image, and form asset URLs', () => {
    const html = `
      <html>
        <head>
          <link href="/assets/css/style_v2.css" rel="stylesheet">
          <script src="/assets/vendor/jquery/jquery.min.js"></script>
        </head>
        <body>
          <img id="car_img_file_url_1" src="/carimage/one.jpg">
          <form action="/Service/CheckPaper"></form>
        </body>
      </html>
    `

    const rewritten = rewriteCheckPaperHtml(html, finalUrl)

    expect(rewritten).toContain('/api/v2/checkpaper/asset?url=')
    expect(rewritten).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css'
      )
    )
    expect(rewritten).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/assets/vendor/jquery/jquery.min.js'
      )
    )
    expect(rewritten).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/carimage/one.jpg'
      )
    )
    expect(rewritten).toContain('action="/Service/CheckPaper"')
  })
})
