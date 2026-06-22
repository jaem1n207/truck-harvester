import { describe, expect, it } from 'vitest'

import {
  isAllowedCheckPaperUrl,
  rewriteCheckPaperCss,
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

  it('sanitizes HTML by removing script tags and inline handlers', () => {
    const html = `
      <html>
        <head>
          <script src="/assets/vendor/jquery/jquery.min.js"></script>
        </head>
        <body>
          <a id="link" href="javascript:alert(1)" onClick="alert(2)">링크</a>
          <button id="button" onclick="alert(3)">버튼</button>
          <img id="car_img_file_url_1" src="javascript:alert(1)">
          <form id="form" action="javascript:alert(1)"></form>
        </body>
      </html>
    `

    const rewritten = rewriteCheckPaperHtml(html, finalUrl)

    expect(rewritten).not.toContain('<script')
    expect(rewritten).not.toContain('onclick')
    expect(rewritten).not.toContain('onClick')
    expect(rewritten).toContain('href="#"')
    expect(rewritten).toContain('id="button"')
    expect(rewritten).toContain('id="car_img_file_url_1"')
    expect(rewritten).toContain('src="#"')
    expect(rewritten).toContain('action="#"')
  })

  it('rewrites stylesheet, image, and action URLs', () => {
    const html = `
      <html>
        <head>
          <link href="/assets/css/style_v2.css" rel="stylesheet">
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
        'https://checkpaper.jmenetworks.co.kr/carimage/one.jpg'
      )
    )
    expect(rewritten).toContain('action="/Service/CheckPaper"')
  })

  it('rewrites CSS url() and @import references to the asset proxy', () => {
    const css = `
      .hero { background-image: url('/assets/bg.jpg'); }
      @import url('./style.css');
      @import "./sub.css" screen;
      .skip { background: url('data:image/png;base64,iVBORw0KGgo='); }
      .skip2 { background: url(about:blank); }
      .skip3 { background: url(//cdn.example.com/img.png); }
      .skip4 { background: url(http://example.com/img.png); }
    `

    const rewritten = rewriteCheckPaperCss(css, finalUrl)

    expect(rewritten).toContain(
      encodeURIComponent('https://checkpaper.jmenetworks.co.kr/assets/bg.jpg')
    )
    expect(rewritten).toContain(
      encodeURIComponent(
        'https://checkpaper.jmenetworks.co.kr/Service/style.css'
      )
    )
    expect(rewritten).toContain(
      encodeURIComponent('https://checkpaper.jmenetworks.co.kr/Service/sub.css')
    )
    expect(rewritten).toContain('data:image/png;base64,iVBORw0KGgo=')
    expect(rewritten).toContain('about:blank')
    expect(rewritten).toContain('//cdn.example.com/img.png')
    expect(rewritten).toContain('http://example.com/img.png')
  })
})
