import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'

import {
  createTimeoutBudget,
  fetchWithManualRedirect,
  isAllowedCheckPaperUrl,
  readResponseArrayBufferWithTimeout,
  readResponseTextWithTimeout,
  rewriteCheckPaperCss,
  rewriteCheckPaperHtml,
  toCheckPaperAssetProxyUrl,
} from '../checkpaper-proxy'

const finalUrl =
  'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107099659&print=0&iframe=1&key='
const carmodooUrl =
  'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

describe('checkpaper proxy helpers', () => {
  it('allows only supported performance-check hosts', () => {
    expect(isAllowedCheckPaperUrl(finalUrl)).toBe(true)
    expect(
      isAllowedCheckPaperUrl(
        'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3'
      )
    ).toBe(true)
    expect(isAllowedCheckPaperUrl(carmodooUrl)).toBe(true)
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
          <a id="adobe" href="https://www.adobe.com/get.adobe.com/reader">adobe</a>
          <a id="link" href="javascript:alert(1)" onClick="alert(2)">링크</a>
          <button id="button" onclick="alert(3)">버튼</button>
          <img id="car_img_file_url_1" src="javascript:alert(1)">
          <form id="form" action="javascript:alert(1)"></form>
          <form id="external" action="https://example.com/post"></form>
          <form id="weird-http" action="http:evil.com"></form>
          <form id="weird-http-slash" action="http:/evil.com"></form>
          <form id="weird-https" action="https:evil.com"></form>
          <form id="protocol-relative" action="//evil.com/post"></form>
          <form id="relative-plain" action="CheckPaper"></form>
          <form id="allowed" action="https://checkpaper.jmenetworks.co.kr/Service/CheckPaper"></form>
          <form id="relative" action="/Service/CheckPaper"></form>
        </body>
      </html>
    `

    const rewritten = rewriteCheckPaperHtml(html, finalUrl)

    expect(rewritten).not.toContain('<script')
    expect(rewritten).not.toContain('onclick')
    expect(rewritten).not.toContain('onClick')
    expect(rewritten).not.toContain('id="adobe"')
    expect(rewritten).not.toContain('adobe')
    expect(rewritten).toContain('href="#"')
    expect(rewritten).toContain('id="button"')
    expect(rewritten).toContain('id="car_img_file_url_1"')
    expect(rewritten).toContain('src="#"')
    expect(rewritten).toContain('action="#"')
    expect(rewritten).toContain('id="weird-http"')
    expect(rewritten).toContain('action="#"')
    expect(rewritten).toContain('id="allowed"')
    expect(rewritten).toContain(
      'action="https://checkpaper.jmenetworks.co.kr/Service/CheckPaper"'
    )
    expect(rewritten).toContain('action="CheckPaper"')
    expect(rewritten).toContain('action="/Service/CheckPaper"')
    expect(rewritten).toContain('id="relative"')
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

  it('rewrites Carmodoo stylesheet and image URLs through the asset proxy', () => {
    const html = `
      <html>
        <head>
          <link href="/css/print_repair.css?ver=2" rel="stylesheet">
        </head>
        <body>
          <div class="repaircheck_box">
            <img id="scene" src="/data/__check/20241011/photo.jpg">
          </div>
        </body>
      </html>
    `

    const rewritten = rewriteCheckPaperHtml(html, carmodooUrl)

    expect(rewritten).toContain('/api/v2/checkpaper/asset?url=')
    expect(rewritten).toContain(
      encodeURIComponent('https://ck.carmodoo.com/css/print_repair.css?ver=2')
    )
    expect(rewritten).toContain(
      encodeURIComponent(
        'https://ck.carmodoo.com/data/__check/20241011/photo.jpg'
      )
    )
  })

  it('does not preserve malicious absolute URLs that only contain the asset proxy path', () => {
    const maliciousProxyUrl = `https://evil.example/api/v2/checkpaper/asset?url=${encodeURIComponent(
      'https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css'
    )}`
    const html = `
      <html>
        <head>
          <link id="style" href="${maliciousProxyUrl}" rel="stylesheet">
        </head>
        <body>
          <img id="scene" src="${maliciousProxyUrl}">
        </body>
      </html>
    `
    const css = `.scene { background-image: url("${maliciousProxyUrl}"); }`

    const rewrittenHtml = rewriteCheckPaperHtml(html, finalUrl)
    const $ = load(rewrittenHtml)
    const rewrittenCss = rewriteCheckPaperCss(css, finalUrl)

    expect($('#style').attr('href')).toBeUndefined()
    expect($('#scene').attr('src')).toBeUndefined()
    expect(rewrittenCss).not.toContain(maliciousProxyUrl)
  })

  it('keeps already proxied asset URLs only when their wrapped target is allowed', () => {
    const allowedAlreadyProxiedUrl = `/api/v2/checkpaper/asset?url=${encodeURIComponent(
      'https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css'
    )}`
    const html = `
      <html>
        <head>
          <link id="style" href="${allowedAlreadyProxiedUrl}" rel="stylesheet">
        </head>
        <body>
          <img id="scene" src="${allowedAlreadyProxiedUrl}">
        </body>
      </html>
    `
    const css = `.scene { background-image: url("${allowedAlreadyProxiedUrl}"); }`

    const rewrittenHtml = rewriteCheckPaperHtml(html, finalUrl)
    const $ = load(rewrittenHtml)
    const rewrittenCss = rewriteCheckPaperCss(css, finalUrl)

    expect($('#style').attr('href')).toBe(allowedAlreadyProxiedUrl)
    expect($('#scene').attr('src')).toBe(allowedAlreadyProxiedUrl)
    expect(rewrittenCss).toContain(allowedAlreadyProxiedUrl)
  })

  it('applies known Carmodoo literal script data before removing scripts', () => {
    const html = `
      <html>
        <body>
          <input id="bc_2_1" type="checkbox">
          <input id="bc_2_2" type="checkbox">
          <input id="dc_81_1" type="checkbox">
          <img id="accout_6" width="10" height="10">
          <div id="repair_wrap_data">
            <div class="c14"></div>
          </div>
          <script>
            setData('bc', '{"2":"1"}');
            setData('dc', '{"81":"1"}');
            var ucAccOutCheck = '{"6":"W"}';
            var ucImgOnCheck = '{"14":"X"}';
          </script>
        </body>
      </html>
    `

    const rewritten = rewriteCheckPaperHtml(html, carmodooUrl)
    const $ = load(rewritten)

    expect($('script')).toHaveLength(0)
    expect($('#bc_2_1').attr('checked')).toBe('checked')
    expect($('#bc_2_2').attr('checked')).toBeUndefined()
    expect($('#dc_81_1').attr('checked')).toBe('checked')
    expect($('#accout_6').attr('src')).toContain(
      '/api/v2/checkpaper/asset?url='
    )
    expect($('#accout_6').attr('src')).toContain(
      encodeURIComponent('https://ck.carmodoo.com/images/check/icon_w.png')
    )
    expect($('#repair_wrap_data .c14 img').attr('src')).toContain(
      encodeURIComponent('https://ck.carmodoo.com/images/check/icon_x.png')
    )
  })

  it('ignores malformed Carmodoo literal data without touching unrelated elements', () => {
    const html = `
      <html>
        <body>
          <input id="bc_2_1" type="checkbox">
          <img id="accout_6" width="10" height="10">
          <div id="repair_wrap_data">
            <div class="c14"></div>
          </div>
          <div id="unrelated">
            <img src="/images/original.png">
          </div>
          <script>
            setData('bc', '{"[":"1","2":"1, input","3":"0"}');
            var ucAccOutCheck = '{"6, img":"W","6":"javascript:alert(1)"}';
            var ucImgOnCheck = '{"14, img":"X","14":"XX"}';
          </script>
        </body>
      </html>
    `

    expect(() => rewriteCheckPaperHtml(html, carmodooUrl)).not.toThrow()

    const rewritten = rewriteCheckPaperHtml(html, carmodooUrl)
    const $ = load(rewritten)

    expect($('#bc_2_1').attr('checked')).toBeUndefined()
    expect($('#accout_6').attr('src')).toBeUndefined()
    expect($('#repair_wrap_data .c14 img')).toHaveLength(0)
    expect($('#unrelated img')).toHaveLength(1)
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

  it('exposes a total timeout budget with a deadline', () => {
    vi.useFakeTimers()

    const budget = createTimeoutBudget(250)
    const before = budget.getRemainingMs()

    vi.advanceTimersByTime(250)
    const after = budget.getRemainingMs()

    expect(before).toBeGreaterThan(0)
    expect(before).toBeLessThanOrEqual(250)
    expect(after).toBe(0)

    vi.useRealTimers()
  })

  it('shares timeout budget between redirects and later body read attempts', async () => {
    const headers = {
      'User-Agent': 'test',
    }
    const budget = createTimeoutBudget(300)
    const redirectDelay = 20

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => {
              resolve(
                new Response(null, {
                  status: 302,
                  headers: {
                    Location:
                      'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?step=2',
                  },
                })
              )
            }, redirectDelay)
          })
      )
      .mockResolvedValueOnce(
        new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      )

    vi.stubGlobal('fetch', fetchMock)

    const redirectPromise = fetchWithManualRedirect(
      'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?step=1',
      headers,
      budget
    )

    await new Promise((resolve) => setTimeout(resolve, redirectDelay + 1))
    await redirectPromise

    const remainingBudgetMs = budget.getRemainingMs()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(remainingBudgetMs).toBeLessThan(300)
    expect(remainingBudgetMs).toBeGreaterThan(0)

    const response = new Response(
      new ReadableStream({
        pull() {
          return new Promise(() => {})
        },
      }),
      { status: 200 }
    )
    const bodyReadResult = readResponseTextWithTimeout(
      response,
      remainingBudgetMs
    ).then(
      (result) => ({ result }),
      (error) => ({ error })
    )

    const settledBodyRead = await bodyReadResult

    expect(settledBodyRead).toMatchObject({
      error: { name: 'TimeoutError' },
    })

    vi.unstubAllGlobals()
  })

  it('cancels a real response reader when body read times out', async () => {
    const cancelSpy = vi.spyOn(ReadableStreamDefaultReader.prototype, 'cancel')
    const response = new Response(
      new ReadableStream({
        pull() {
          return new Promise(() => {})
        },
      }),
      { status: 200 }
    )

    const bodyReadResult = readResponseTextWithTimeout(response, 10).then(
      (result) => ({ result }),
      (error) => ({ error })
    )

    const settledBodyRead = await bodyReadResult

    expect(settledBodyRead).toMatchObject({
      error: { name: 'TimeoutError' },
    })
    expect(cancelSpy).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('reads response body as array-buffer using stream chunks', async () => {
    const encoder = new TextEncoder()
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('ab'))
          controller.enqueue(encoder.encode('cd'))
          controller.close()
        },
      }),
      { status: 200 }
    )

    const arrayBuffer = await readResponseArrayBufferWithTimeout(response, 1000)
    const result = new TextDecoder().decode(new Uint8Array(arrayBuffer))

    expect(result).toBe('abcd')
  })
})
