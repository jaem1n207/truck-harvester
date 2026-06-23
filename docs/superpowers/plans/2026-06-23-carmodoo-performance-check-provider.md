# Carmodoo Performance Check Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Carmodoo `checkNum` performance-check support through a provider registry while preserving the existing CheckPaper PDF save flow.

**Architecture:** Keep file and ZIP saving unchanged: they still consume `Uint8Array[]` from `capturePerformanceCheckImages()`. Split performance-check capture selection into providers inside `src/v2/features/file-management/performance-check-capture.ts`: one provider renders existing CheckPaper printable PDFs, and one provider captures Carmodoo HTML `.page_wrap` elements with injected print layout CSS. Expand the existing same-origin CheckPaper proxy to allow only `ck.carmodoo.com` in addition to the current hosts and to safely apply known Carmodoo literal script data before scripts are removed.

**Tech Stack:** Next.js App Router route handlers, TypeScript strict mode, Cheerio, `html2canvas`, `pdfjs-dist`, JSZip, Vitest, Bun.

---

## Scope Check

This plan covers one implementation unit: performance-check provider expansion for Carmodoo HTML records. It does not redesign UI, change analytics payloads, add new external hosts beyond `ck.carmodoo.com`, automate SmartStore upload, or introduce headless browser rendering.

Before executing any task, confirm the branch state:

```bash
git status --branch --short
git log --oneline HEAD..origin/main
```

Expected: the working tree is clean or only contains this plan, and `git log --oneline HEAD..origin/main` prints no commits. If upstream has new commits, stop and reconcile before editing implementation files.

## File Structure

- Modify `src/v2/shared/lib/checkpaper-proxy.ts`
  - Add `ck.carmodoo.com` to the allowed host set.
  - Apply known Carmodoo literal script data to the DOM before removing scripts.
  - Keep script execution disabled and keep unsafe asset/action filtering.
- Modify `src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts`
  - Cover Carmodoo host allowlisting, asset rewriting, and safe script-data application.
- Modify `src/app/api/v2/checkpaper/__tests__/route.test.ts`
  - Prove the HTML proxy fetches and rewrites Carmodoo HTML.
- Modify `src/app/api/v2/checkpaper/asset/__tests__/route.test.ts`
  - Prove the asset proxy forwards Carmodoo CSS/images and keeps active document blocking.
- Modify `src/v2/features/file-management/performance-check-capture.ts`
  - Introduce provider selection and move the existing CheckPaper PDF behavior behind `checkpaperPdfProvider`.
  - Add `carmodooHtmlProvider` for `.page_wrap` capture with print-layout injection.
  - Preserve the `preferPrintablePdf: false` HTML fallback used by existing tests.
- Modify `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`
  - Cover provider selection for CheckPaper PDF, direct Carmodoo URL, and autocafe-resolved Carmodoo URL.
  - Cover Carmodoo print layout injection, two-page-wrap output, cleanup, timeout, and abort behavior.
- Modify `src/v2/features/file-management/__tests__/zip-fallback.test.ts`
  - Strengthen ZIP regression coverage for multiple returned performance-check images.
- Modify `docs/architecture.md`
  - Update CheckPaper Integration wording to mention supported printable PDF and Carmodoo HTML provider paths.

## Task 1: Extend The Proxy Helper For Carmodoo Safely

**Files:**

- Modify: `src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts`
- Modify: `src/v2/shared/lib/checkpaper-proxy.ts`

- [ ] **Step 1: Write the failing allowlist and rewrite tests**

Add these constants near the existing `finalUrl` constant in `src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts`:

```ts
const carmodooUrl = 'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'
```

Update the existing allowlist test name and body:

```ts
it('allows only supported performance-check hosts', () => {
  expect(isAllowedCheckPaperUrl(finalUrl)).toBe(true)
  expect(isAllowedCheckPaperUrl('http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3')).toBe(
    true
  )
  expect(isAllowedCheckPaperUrl(carmodooUrl)).toBe(true)
  expect(isAllowedCheckPaperUrl('https://example.com/CheckPaper')).toBe(false)
  expect(isAllowedCheckPaperUrl('ftp://checkpaper.jmenetworks.co.kr/Service/CheckPaper')).toBe(
    false
  )
})
```

Add this test inside `describe('checkpaper proxy helpers', () => { ... })`:

```ts
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
    encodeURIComponent('https://ck.carmodoo.com/data/__check/20241011/photo.jpg')
  )
})
```

- [ ] **Step 2: Write the failing Carmodoo script-data sanitization test**

Add `load` to the test file imports:

```ts
import { load } from 'cheerio'
```

Add this test inside `describe('checkpaper proxy helpers', () => { ... })`:

```ts
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
  expect($('#accout_6').attr('src')).toContain('/api/v2/checkpaper/asset?url=')
  expect($('#accout_6').attr('src')).toContain(
    encodeURIComponent('https://ck.carmodoo.com/images/check/icon_w.png')
  )
  expect($('#repair_wrap_data .c14 img').attr('src')).toContain(
    encodeURIComponent('https://ck.carmodoo.com/images/check/icon_x.png')
  )
})
```

- [ ] **Step 3: Run the proxy helper tests and verify they fail**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts
```

Expected: FAIL. The allowlist rejects `ck.carmodoo.com`, and the Carmodoo literal script data is not applied.

- [ ] **Step 4: Implement the Carmodoo host and literal-data helpers**

In `src/v2/shared/lib/checkpaper-proxy.ts`, add `ck.carmodoo.com` to `allowedCheckPaperHosts`:

```ts
const allowedCheckPaperHosts = new Set([
  'autocafe.co.kr',
  'checkpaper.jmenetworks.co.kr',
  'ck.carmodoo.com',
])
```

Add these helper functions above `export function rewriteCheckPaperHtml(...)`:

```ts
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

function extractCarmodooSetData(scriptText: string, prefix: string): Record<string, string> {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`setData\\(\\s*['"]${escapedPrefix}['"]\\s*,\\s*(['"])(.*?)\\1`, 'gs')
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
  const pattern = new RegExp(`var\\s+${escapedName}\\s*=\\s*(['"])(.*?)\\1\\s*;`, 's')
  const match = scriptText.match(pattern)

  return parseJsonObjectLiteral(match?.[2] ?? '{}')
}

function applyCarmodooCheckboxData(
  $: ReturnType<typeof load>,
  prefix: string,
  values: Record<string, string>
) {
  Object.entries(values).forEach(([key, value]) => {
    if (!value || value === '0') {
      return
    }

    $(`#${prefix}_${key}_${value}`).attr('checked', 'checked')
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
    const marker = value.trim().toLowerCase()

    if (!marker) {
      return
    }

    const proxiedIconUrl = toCheckPaperAssetProxyUrl(`/images/check/icon_${marker}.png`, baseUrl)
    const node = $(`${selectorPrefix}${key}`)

    if (node.is('img')) {
      node.attr('src', proxiedIconUrl)
      node.attr('alt', value)
      return
    }

    node.html(`<img src="${proxiedIconUrl}" alt="${value}">`)
  })
}

function applyCarmodooLiteralScriptData($: ReturnType<typeof load>, baseUrl: string) {
  const scriptText = $('script')
    .toArray()
    .map((element) => $(element).text())
    .join('\n')

  ;['bc', 'mac', 'dc', 'eac'].forEach((prefix) => {
    applyCarmodooCheckboxData($, prefix, extractCarmodooSetData(scriptText, prefix))
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
```

Then call the helper at the start of `rewriteCheckPaperHtml`, immediately after `baseUrl` is computed and before `$('script').remove()`:

```ts
export function rewriteCheckPaperHtml(html: string, finalUrl: string) {
  const $ = load(html)
  const baseUrl = new URL(finalUrl).toString()

  applyCarmodooLiteralScriptData($, baseUrl)

  $('script').remove()
  // existing sanitization continues here
}
```

- [ ] **Step 5: Run the proxy helper tests and verify they pass**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the proxy helper change**

Run:

```bash
git add src/v2/shared/lib/checkpaper-proxy.ts src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts
git commit -m "fix: 카모두 성능점검 프록시 허용"
```

## Task 2: Prove The API Routes Support Carmodoo

**Files:**

- Modify: `src/app/api/v2/checkpaper/__tests__/route.test.ts`
- Modify: `src/app/api/v2/checkpaper/asset/__tests__/route.test.ts`

- [ ] **Step 1: Add Carmodoo HTML route coverage**

In `src/app/api/v2/checkpaper/__tests__/route.test.ts`, add this constant near `finalUrl`:

```ts
const carmodooUrl = 'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'
```

Add this test inside `describe('GET /api/v2/checkpaper', () => { ... })`:

```ts
it('fetches and rewrites Carmodoo html', async () => {
  const carmodooHtml = `
    <html>
      <head>
        <link href="/css/print_repair.css?ver=2" rel="stylesheet">
        <script>setData('bc', '{"2":"1"}');</script>
      </head>
      <body>
        <div class="repaircheck_box">
          <input id="bc_2_1" type="checkbox">
          <div class="page_wrap"><div class="page_col1"></div><div class="page_col2"></div></div>
        </div>
      </body>
    </html>
  `
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(carmodooHtml, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  )
  vi.stubGlobal('fetch', fetchMock)

  const response = await GET(createRequest(carmodooUrl))
  const body = await response.text()

  expect(response.status).toBe(200)
  expect(fetchMock).toHaveBeenCalledWith(
    carmodooUrl,
    expect.objectContaining({
      cache: 'no-store',
      redirect: 'manual',
      headers: expect.objectContaining({
        'User-Agent': expect.any(String),
      }),
    })
  )
  expect(response.headers.get('x-checkpaper-final-url')).toBe(carmodooUrl)
  expect(body).toContain('/api/v2/checkpaper/asset?url=')
  expect(body).toContain(encodeURIComponent('https://ck.carmodoo.com/css/print_repair.css?ver=2'))
  expect(body).toContain('id="bc_2_1"')
  expect(body).toContain('checked="checked"')
  expect(body).not.toContain('<script')
})
```

- [ ] **Step 2: Add Carmodoo asset route coverage**

In `src/app/api/v2/checkpaper/asset/__tests__/route.test.ts`, add this constant near `sourceUrl`:

```ts
const carmodooCssUrl = 'https://ck.carmodoo.com/css/print_repair.css?ver=2'
```

Add this test inside `describe('GET /api/v2/checkpaper/asset', () => { ... })`:

```ts
it('rewrites relative Carmodoo css references when serving css assets', async () => {
  const css = `
    .repaircheck_box input:checked { background-image: url(/images/input_checkbox.png); }
    .photo { background: url('../images/check/icon_w.png'); }
  `
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(css, {
      status: 200,
      headers: { 'content-type': 'text/css; charset=utf-8' },
    })
  )
  vi.stubGlobal('fetch', fetchMock)

  const response = await GET(createRequest(carmodooCssUrl))
  const rewritten = await response.text()

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8')
  expect(rewritten).toContain(
    encodeURIComponent('https://ck.carmodoo.com/images/input_checkbox.png')
  )
  expect(rewritten).toContain(encodeURIComponent('https://ck.carmodoo.com/images/check/icon_w.png'))
})
```

- [ ] **Step 3: Run the API route tests**

Run:

```bash
bun run test -- --run src/app/api/v2/checkpaper/__tests__/route.test.ts src/app/api/v2/checkpaper/asset/__tests__/route.test.ts
```

Expected: PASS after Task 1. If this fails because the route rejects Carmodoo, return to Task 1 and fix allowlist propagation before continuing.

- [ ] **Step 4: Commit the route coverage**

Run:

```bash
git add src/app/api/v2/checkpaper/__tests__/route.test.ts src/app/api/v2/checkpaper/asset/__tests__/route.test.ts
git commit -m "test: 카모두 성능점검 라우트 검증"
```

## Task 3: Add Capture Provider Selection And Carmodoo HTML Capture

**Files:**

- Modify: `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`
- Modify: `src/v2/features/file-management/performance-check-capture.ts`

- [ ] **Step 1: Add Carmodoo constants to the capture tests**

In `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`, add these constants near the current URL constants:

```ts
const carmodooSourceUrl =
  'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'
const proxiedCarmodooSourceUrl = `/api/v2/checkpaper?url=${encodeURIComponent(carmodooSourceUrl)}`
```

- [ ] **Step 2: Write the failing direct Carmodoo provider test**

Add this test inside `describe('capturePerformanceCheckImages', () => { ... })`:

```ts
it('captures Carmodoo page_wrap elements with injected print layout', async () => {
  const firstCanvas = createCanvas([11, 12])
  const secondCanvas = createCanvas([13, 14])
  const renderPage = vi
    .fn<PerformanceCheckPageRenderer>()
    .mockImplementationOnce(async (page) => {
      expect(page.classList.contains('page_wrap')).toBe(true)
      expect(
        page.ownerDocument.querySelector('style[data-performance-check-provider="carmodoo-html"]')
          ?.textContent
      ).toContain('.repaircheck_box')
      return firstCanvas
    })
    .mockImplementationOnce(async (page) => {
      expect(page.classList.contains('page_wrap')).toBe(true)
      return secondCanvas
    })
  const fetchPdf = vi.fn()
  const renderPdfPages = vi.fn()
  const resolvePrintableUrl = vi.fn()

  const capturePromise = capturePerformanceCheckImages(carmodooSourceUrl, {
    fetchPdf,
    renderPage,
    renderPdfPages,
    resolvePrintableUrl,
  })

  const iframe = document.querySelector('iframe') as HTMLIFrameElement
  expect(iframe.getAttribute('src')).toBe(proxiedCarmodooSourceUrl)

  addPagesToIframe(`
    <div class="repaircheck_box">
      <section class="page_wrap" id="spread-one"></section>
      <section class="page_wrap" id="spread-two"></section>
    </div>
  `)
  dispatchIframeLoad()

  await expect(capturePromise).resolves.toEqual([
    new Uint8Array([11, 12]),
    new Uint8Array([13, 14]),
  ])
  expect(resolvePrintableUrl).not.toHaveBeenCalled()
  expect(fetchPdf).not.toHaveBeenCalled()
  expect(renderPdfPages).not.toHaveBeenCalled()
  expect(renderPage).toHaveBeenCalledTimes(2)
  expect(document.querySelector('iframe')).toBeNull()
})
```

- [ ] **Step 3: Write the failing autocafe-to-Carmodoo resolver test**

Add this test inside `describe('capturePerformanceCheckImages', () => { ... })`:

```ts
it('uses the Carmodoo provider after resolving an autocafe URL', async () => {
  const canvas = createCanvas([21])
  const resolvePrintableUrl = vi.fn(async () => carmodooSourceUrl)
  const renderPage = vi.fn<PerformanceCheckPageRenderer>().mockResolvedValue(canvas)
  const fetchPdf = vi.fn()

  const capturePromise = capturePerformanceCheckImages(autocafeSourceUrl, {
    fetchPdf,
    renderPage,
    resolvePrintableUrl,
  })

  const iframe = document.querySelector('iframe') as HTMLIFrameElement
  expect(iframe.getAttribute('src')).toBe(proxiedCarmodooSourceUrl)

  addPagesToIframe('<div class="repaircheck_box"><section class="page_wrap"></section></div>')
  dispatchIframeLoad()

  await expect(capturePromise).resolves.toEqual([new Uint8Array([21])])
  expect(resolvePrintableUrl).toHaveBeenCalledWith(autocafeSourceUrl, {
    proxyPath: '/api/v2/checkpaper',
    signal: undefined,
  })
  expect(fetchPdf).not.toHaveBeenCalled()
  expect(renderPage).toHaveBeenCalledTimes(1)
  expect(document.querySelector('iframe')).toBeNull()
})
```

- [ ] **Step 4: Write the failing Carmodoo missing-page cleanup test**

Add this test inside `describe('capturePerformanceCheckImages', () => { ... })`:

```ts
it('rejects and cleans up when the Carmodoo document has no page_wrap elements', async () => {
  const renderPage = vi.fn<PerformanceCheckPageRenderer>()

  const capturePromise = capturePerformanceCheckImages(carmodooSourceUrl, {
    renderPage,
  })

  addPagesToIframe('<div class="repaircheck_box"><main>문서를 찾지 못했습니다.</main></div>')
  dispatchIframeLoad()

  await expect(capturePromise).rejects.toThrow('성능점검기록부 페이지를 찾지 못했습니다.')
  expect(renderPage).not.toHaveBeenCalled()
  expect(document.querySelector('iframe')).toBeNull()
})
```

- [ ] **Step 5: Run the new capture tests and verify they fail**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: FAIL. The current code cannot select a Carmodoo HTML provider when `preferPrintablePdf` is true.

- [ ] **Step 6: Add provider types and selectors**

In `src/v2/features/file-management/performance-check-capture.ts`, add these types after `CapturePerformanceCheckImagesOptions`:

```ts
type CaptureContext = {
  assetProxyPath: string
  fetchPdf: PerformanceCheckPdfFetcher
  jpegQuality: number
  ownerDocument: Document
  proxyPath: string
  renderPage: PerformanceCheckPageRenderer
  renderPdfPages: PerformanceCheckPdfRenderer
  signal?: AbortSignal
  timeoutMs: number
}

type PerformanceCheckCaptureProvider = {
  id: 'checkpaper-pdf' | 'carmodoo-html'
  canHandle: (url: URL) => boolean
  capture: (url: URL, context: CaptureContext) => Promise<Uint8Array[]>
}
```

Rename `derivePrintableRecordUrl` to `deriveCheckPaperPrintableRecordUrl` and keep its current body. Add these helpers below it:

```ts
function parsePerformanceCheckUrl(value: string) {
  try {
    const url = new URL(value)

    if (!/^https?:$/i.test(url.protocol)) {
      return undefined
    }

    return url
  } catch {
    return undefined
  }
}

function isCarmodooPrintUrl(url: URL) {
  return (
    url.hostname === 'ck.carmodoo.com' &&
    url.pathname.toLowerCase() === '/carcheck/carmodooprint.do' &&
    Boolean(url.searchParams.get('checkNum')?.trim())
  )
}
```

- [ ] **Step 7: Make HTML capture configurable by page selector and preparation hook**

Change the `captureHtmlPageImages` parameter object type to include:

```ts
  pageSelector?: string
  prepareFrameDocument?: (frameDocument: Document) => void
```

Set defaults in the function signature:

```ts
  pageSelector = '.page',
  prepareFrameDocument,
```

After `assertNotAborted(signal)` in `captureHtmlPageImages`, call:

```ts
prepareFrameDocument?.(frameDocument)
```

Replace the hard-coded selector:

```ts
const pages = Array.from(frameDocument.querySelectorAll<HTMLElement>(pageSelector))
```

- [ ] **Step 8: Add Carmodoo print layout injection**

Add this helper above the provider definitions:

```ts
function injectCarmodooPrintLayout(frameDocument: Document) {
  if (frameDocument.querySelector('style[data-performance-check-provider="carmodoo-html"]')) {
    return
  }

  const style = frameDocument.createElement('style')
  style.dataset.performanceCheckProvider = 'carmodoo-html'
  style.textContent = `
    .repaircheck_box {
      margin: 0 !important;
      width: 1400px !important;
    }
    .repaircheck_box .btn_box {
      display: none !important;
    }
    .repaircheck_box .page_wrap {
      clear: both;
      display: block;
      height: 950px;
      page-break-after: always;
      page-break-before: auto;
      width: 100%;
    }
    .repaircheck_box .page_col1 {
      float: left;
      width: 49%;
    }
    .repaircheck_box .page_col2 {
      float: right;
      width: 49%;
    }
    .repaircheck_box .fuc_print {
      display: block !important;
    }
  `

  frameDocument.head.appendChild(style)
}
```

- [ ] **Step 9: Add the provider registry**

Add these provider definitions above `export async function capturePerformanceCheckImages(...)`:

```ts
const checkpaperPdfProvider: PerformanceCheckCaptureProvider = {
  id: 'checkpaper-pdf',
  canHandle(url) {
    return Boolean(deriveCheckPaperPrintableRecordUrl(url.toString()))
  },
  capture(url, context) {
    const printableRecordUrl = deriveCheckPaperPrintableRecordUrl(url.toString())

    if (!printableRecordUrl) {
      throw new Error('성능점검기록부 인쇄본 주소를 찾지 못했습니다.')
    }

    return capturePrintablePdfImages({
      assetProxyPath: context.assetProxyPath,
      fetchPdf: context.fetchPdf,
      jpegQuality: context.jpegQuality,
      ownerDocument: context.ownerDocument,
      printableRecordUrl,
      renderPdfPages: context.renderPdfPages,
      signal: context.signal,
      timeoutMs: context.timeoutMs,
    })
  },
}

const carmodooHtmlProvider: PerformanceCheckCaptureProvider = {
  id: 'carmodoo-html',
  canHandle: isCarmodooPrintUrl,
  capture(url, context) {
    return captureHtmlPageImages({
      jpegQuality: context.jpegQuality,
      ownerDocument: context.ownerDocument,
      pageSelector: '.repaircheck_box .page_wrap',
      prepareFrameDocument: injectCarmodooPrintLayout,
      proxyPath: context.proxyPath,
      renderPage: context.renderPage,
      signal: context.signal,
      timeoutMs: context.timeoutMs,
      url: url.toString(),
    })
  },
}

const performanceCheckProviders = [
  checkpaperPdfProvider,
  carmodooHtmlProvider,
] satisfies PerformanceCheckCaptureProvider[]

function findPerformanceCheckProvider(url: URL) {
  return performanceCheckProviders.find((provider) => provider.canHandle(url))
}
```

- [ ] **Step 10: Route capture through providers**

In `capturePerformanceCheckImages`, build a context after `ownerDocument` is validated:

```ts
const captureContext: CaptureContext = {
  assetProxyPath,
  fetchPdf,
  jpegQuality,
  ownerDocument,
  proxyPath,
  renderPage,
  renderPdfPages,
  signal,
  timeoutMs,
}
```

Replace the existing `printableRecordUrl` and `resolvedPrintableRecordUrl` block with:

```ts
if (!preferPrintablePdf) {
  return captureHtmlPageImages({
    jpegQuality,
    ownerDocument,
    proxyPath,
    renderPage,
    signal,
    timeoutMs,
    url: trimmedUrl,
  })
}

const sourceUrl = parsePerformanceCheckUrl(trimmedUrl)
const sourceProvider = sourceUrl ? findPerformanceCheckProvider(sourceUrl) : undefined

if (sourceUrl && sourceProvider) {
  return sourceProvider.capture(sourceUrl, captureContext)
}

const resolvedUrl = await withAbort(
  resolvePrintableUrl(trimmedUrl, {
    proxyPath,
    signal,
  }),
  signal
)
const resolvedPerformanceCheckUrl = resolvedUrl ? parsePerformanceCheckUrl(resolvedUrl) : undefined
const resolvedProvider = resolvedPerformanceCheckUrl
  ? findPerformanceCheckProvider(resolvedPerformanceCheckUrl)
  : undefined

if (resolvedPerformanceCheckUrl && resolvedProvider) {
  return resolvedProvider.capture(resolvedPerformanceCheckUrl, captureContext)
}

throw new Error('성능점검기록부 인쇄본 주소를 찾지 못했습니다.')
```

- [ ] **Step 11: Run the capture tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: PASS. Existing CheckPaper PDF tests, `preferPrintablePdf: false` HTML tests, and new Carmodoo tests all pass.

- [ ] **Step 12: Commit the capture provider change**

Run:

```bash
git add src/v2/features/file-management/performance-check-capture.ts src/v2/features/file-management/__tests__/performance-check-capture.test.ts
git commit -m "fix: 카모두 성능점검기록부 캡처 추가"
```

## Task 4: Strengthen Save-Layer Regression Coverage

**Files:**

- Modify: `src/v2/features/file-management/__tests__/zip-fallback.test.ts`

- [ ] **Step 1: Update ZIP structured-folder test to assert multiple performance-check images**

In `src/v2/features/file-management/__tests__/zip-fallback.test.ts`, update the `creates an archive with structured folders and save results` test so the injected capture returns two images:

```ts
capturePerformanceCheckImages: vi.fn(async () => [
  new Uint8Array([7, 8]),
  new Uint8Array([9, 10]),
]),
```

Update the expectations in that test:

```ts
expect(zip.file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_1.jpg')).toBeTruthy()
expect(zip.file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_2.jpg')).toBeTruthy()
expect(results).toEqual([
  {
    performanceCheckImageCount: 2,
    performanceCheckStatus: 'saved',
    sourceUrl: listing.url,
    vehicleImageCount: 2,
    vehicleImageStatus: 'complete',
    vehicleImageTotalCount: 2,
    vehicleFolderName: '12가_3456',
    vehicleNumber: '12가/3456',
  },
])
```

Add a byte assertion for the second record image:

```ts
await expect(
  zip.file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_2.jpg')!.async('uint8array')
).resolves.toEqual(new Uint8Array([9, 10]))
```

- [ ] **Step 2: Run save-layer tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts
```

Expected: PASS. `file-system.test.ts` already covers two returned performance-check images; the ZIP test now does too.

- [ ] **Step 3: Commit the save regression change**

Run:

```bash
git add src/v2/features/file-management/__tests__/zip-fallback.test.ts
git commit -m "test: 성능점검기록부 다중 zip 저장 검증"
```

## Task 5: Update Architecture Docs And Run Full Verification

**Files:**

- Modify: `docs/architecture.md`

- [ ] **Step 1: Update CheckPaper Integration wording**

In `docs/architecture.md`, replace this paragraph in `## CheckPaper Integration`:

```md
`POST /api/v2/parse-truck` returns `performanceCheckUrl` when the listing page
contains a `성능점검보기` link. During save, the client asks the same-origin
CheckPaper routes to resolve and fetch the printable record:
```

with:

```md
`POST /api/v2/parse-truck` returns `performanceCheckUrl` when the listing page
contains a `성능점검보기` link. During save, the client asks the same-origin
CheckPaper routes to resolve the record and then chooses the supported renderer:
existing CheckPaper `record.do` PDF pages are rendered as JPGs, and Carmodoo
`carmodooPrint.do?checkNum=...` HTML records are captured from their 2-up
print layout as JPGs.
```

Replace this sentence:

```md
The browser renders the printable record pages and converts each page to a JPG
image. The app does not upload these records anywhere; it only saves them into
the user's selected folder or ZIP file.
```

with:

```md
The browser renders the supported record pages and converts each output page to
a JPG image. The app does not upload these records anywhere; it only saves them
into the user's selected folder or ZIP file.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts src/app/api/v2/checkpaper/__tests__/route.test.ts src/app/api/v2/checkpaper/asset/__tests__/route.test.ts src/v2/features/file-management/__tests__/performance-check-capture.test.ts src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full validation**

Run:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
```

Expected: all commands PASS.

- [ ] **Step 4: Run build**

Run:

```bash
bun run build
```

Expected: PASS. If the sandbox blocks Turbopack process or port binding, rerun with escalated permissions and keep the command output in the final report.

- [ ] **Step 5: Commit docs and any formatting-only adjustments**

Run:

```bash
git add docs/architecture.md
git commit -m "docs: 카모두 성능점검 저장 구조 문서화"
```

If Step 3 or Step 4 produced formatter-only changes in files already modified by earlier tasks, include those files in this final commit only when the diff is purely formatting. If the diff changes behavior, stop and create a focused fix commit with tests.

## Self-Review

- Spec coverage: provider registry, Carmodoo host allowlist, safe script-data application, Carmodoo 2-up HTML capture, non-fatal save behavior, ZIP/file-system reuse, and docs are each mapped to a task.
- Gap scan: no ambiguous implementation gaps remain; each task includes exact files, tests, snippets, commands, and expected results.
- Type consistency: provider names, `CaptureContext`, `PerformanceCheckCaptureProvider`, `pageSelector`, `prepareFrameDocument`, and `data-performance-check-provider="carmodoo-html"` are used consistently across tasks.
