import { describe, expect, it, vi } from 'vitest'

import {
  createTimeoutBudget,
  fetchWithManualRedirect,
  isAllowedCheckPaperUrl,
  readResponseBodyWithTimeout,
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
    vi.useFakeTimers()
    try {
      const headers = {
        'User-Agent': 'test',
      }
      const budget = createTimeoutBudget(300)
      const redirectDelay = 120

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

      await vi.advanceTimersByTimeAsync(redirectDelay + 1)
      await redirectPromise

      const remainingBudgetMs = budget.getRemainingMs()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(remainingBudgetMs).toBeLessThan(300)
      expect(remainingBudgetMs).toBeGreaterThan(0)

      const bodyReadDelayMs = remainingBudgetMs + 5
      const bodyReadResult = readResponseBodyWithTimeout(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => {
              resolve('body')
            }, bodyReadDelayMs)
          }),
        remainingBudgetMs
      ).then(
        (result) => ({ result }),
        (error) => ({ error })
      )

      await vi.advanceTimersByTimeAsync(bodyReadDelayMs)
      const settledBodyRead = await bodyReadResult

      expect(settledBodyRead).toMatchObject({
        error: { name: 'TimeoutError' },
      })
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
})
