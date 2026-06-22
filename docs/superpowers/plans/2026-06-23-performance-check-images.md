# Performance Check Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save each listing's performance check record as high-quality JPG files inside the vehicle folder, with a clearer folder structure and a quiet user-visible notice when the record cannot be saved.

**Architecture:** The parse API adds an optional `performanceCheckUrl` to each `TruckListing`. The save layer creates the new vehicle folder structure, proxies CheckPaper HTML/assets through same-origin API routes, renders proxied CheckPaper pages in a hidden iframe, captures each `.page` as JPG with `html2canvas`, and records whether each saved listing has a missing performance check. The status panel keeps vehicle saves successful when only the performance check is missing, but shows one low-noise completion notice and a short affected-card label.

**Tech Stack:** Next.js App Router route handlers, React 19, TypeScript strict mode, Zod, Cheerio, JSZip, Zustand vanilla store, `html2canvas`, Vitest, Playwright smoke coverage.

---

## Scope Check

This plan covers one product capability: performance check image saving during the existing Truck Harvester save flow. It does not automate SmartStore upload, add PDF export, add a paid error-monitoring SDK, or change preview/save concurrency.

Before executing any task, synchronize with GitHub:

```bash
git fetch origin
git status --branch --short
git log --oneline HEAD..origin/main
```

Expected before implementation: `git log --oneline HEAD..origin/main` prints no commits. If it prints commits, stop and reconcile the local branch with `origin/main` before editing files.

## File Structure

- Modify `package.json`
  - Add runtime dependency `html2canvas`.
- Modify `bun.lock`
  - Let `bun add html2canvas` update the lockfile.
- Modify `src/v2/entities/truck/model.ts`
  - Add optional `performanceCheckUrl` to `truckListingSchema`.
- Modify `src/v2/entities/truck/__tests__/model.test.ts`
  - Cover the optional performance check URL.
- Modify `src/v2/shared/lib/parse-truck-html.ts`
  - Extract the `성능점검보기` link and normalize it against the listing URL.
- Modify `src/v2/shared/lib/__tests__/parse-truck-html.test.ts`
  - Cover present and missing performance check links.
- Create `src/v2/shared/lib/checkpaper-proxy.ts`
  - Validate allowed CheckPaper/intermediate hosts and rewrite HTML asset URLs to same-origin proxy URLs.
- Create `src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts`
  - Cover allowed-host validation and asset rewriting.
- Create `src/app/api/v2/checkpaper/route.ts`
  - Fetch CheckPaper/intermediate HTML, follow redirects, rewrite assets, and return same-origin HTML.
- Create `src/app/api/v2/checkpaper/__tests__/route.test.ts`
  - Cover invalid URL, unsupported host, fetch failure, and rewritten success response.
- Create `src/app/api/v2/checkpaper/asset/route.ts`
  - Proxy allowed CSS/script/image assets.
- Create `src/app/api/v2/checkpaper/asset/__tests__/route.test.ts`
  - Cover allowed asset passthrough and unsupported host rejection.
- Create `src/v2/features/file-management/save-result.ts`
  - Define save result types shared by folder and ZIP saves.
- Create `src/v2/features/file-management/performance-check-capture.ts`
  - Fetch proxied CheckPaper HTML, render it in a hidden iframe, capture each `.page` as JPG bytes.
- Create `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`
  - Cover page capture helpers, missing page behavior, and abort behavior using injected renderers.
- Modify `src/v2/features/file-management/filename.ts`
  - Add folder names and file builders for `차량 이미지`, `성능점검기록부`, `원고`, `사진_1.jpg`, `성능점검기록부_1.jpg`, and `차량정보.txt`.
- Modify `src/v2/features/file-management/__tests__/filename.test.ts`
  - Cover the new names and Windows-safe vehicle folder sanitization.
- Modify `src/v2/features/file-management/file-system.ts`
  - Save images, performance check JPGs, and text into the new subfolders.
- Modify `src/v2/features/file-management/__tests__/file-system.test.ts`
  - Cover the new folder structure and non-fatal performance check failures.
- Modify `src/v2/features/file-management/zip-fallback.ts`
  - Put the same structure into ZIP files and return per-truck save results.
- Modify `src/v2/features/file-management/__tests__/zip-fallback.test.ts`
  - Cover the ZIP structure, result propagation, and non-fatal performance check failures.
- Modify `src/v2/features/file-management/index.ts`
  - Export new names, result types, and capture helpers needed by workflow tests.
- Modify `src/v2/features/listing-preparation/model/prepared-listing-store.ts`
  - Store performance check save status on saved listings.
- Modify `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`
  - Cover `markSaved(id, result)` preserving the low-noise missing status.
- Modify `src/v2/application/truck-harvester-workflow/save-workflow.ts`
  - Pass save results from directory and ZIP paths into the prepared-listing store.
- Modify `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`
  - Cover directory and ZIP missing-performance-check results.
- Modify `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`
  - Show one completion summary notice and a short affected-card label.
- Modify `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`
  - Cover the low-noise notice and absence of developer terms.
- Modify `src/app/api/v2/parse-truck/__tests__/route.test.ts`
  - Cover `performanceCheckUrl` in parse response.

## Task 1: Add The Domain Field And Parse The Performance Check Link

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `src/v2/entities/truck/model.ts`
- Modify: `src/v2/entities/truck/__tests__/model.test.ts`
- Modify: `src/v2/shared/lib/parse-truck-html.ts`
- Modify: `src/v2/shared/lib/__tests__/parse-truck-html.test.ts`
- Modify: `src/app/api/v2/parse-truck/__tests__/route.test.ts`

- [ ] **Step 1: Add the capture dependency**

Run:

```bash
bun add html2canvas
```

Expected: `package.json` adds `html2canvas` under `dependencies`, and `bun.lock` changes.

- [ ] **Step 2: Write the entity schema test**

In `src/v2/entities/truck/__tests__/model.test.ts`, update the `listing` fixture to include:

```ts
performanceCheckUrl:
  'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
```

Add this test inside `describe('truckListingSchema', () => { ... })`:

```ts
it('allows listings without a performance check URL', () => {
  const parsed = truckListingSchema.parse({
    ...listing,
    performanceCheckUrl: undefined,
  })

  expect(parsed.performanceCheckUrl).toBeUndefined()
})
```

- [ ] **Step 3: Run the entity test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/entities/truck/__tests__/model.test.ts
```

Expected: FAIL because `performanceCheckUrl` is stripped or not present in the parsed object.

- [ ] **Step 4: Add the optional field to the schema**

In `src/v2/entities/truck/model.ts`, add `performanceCheckUrl` after `url`:

```ts
export const truckListingSchema = z.object({
  url: z.string().url(),
  performanceCheckUrl: z.string().url().optional(),
  vname: z.string().min(1),
  vehicleName: z.string().min(1),
  vnumber: z.string().min(1),
  price: truckPriceSchema,
  year: z.string().min(1),
  mileage: z.string().min(1),
  options: z.string().min(1),
  images: z.array(z.string().url()).default([]),
})
```

- [ ] **Step 5: Run the entity test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/entities/truck/__tests__/model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write parser tests for present and missing links**

In `src/v2/shared/lib/__tests__/parse-truck-html.test.ts`, add this link inside `fullHtml`, before the closing `</body>`:

```html
<dl>
  <dt>성능번호</dt>
  <dd>
    <a href="http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3" class="pc_btn_view"
      >성능점검보기(클릭)</a
    >
  </dd>
</dl>
```

Update the first expected listing object to include:

```ts
performanceCheckUrl:
  'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
```

Add this test:

```ts
it('leaves performanceCheckUrl empty when the listing has no check link', () => {
  const listing = parseTruckHtml(sparseHtml, detailUrl)

  expect(listing.performanceCheckUrl).toBeUndefined()
})
```

- [ ] **Step 7: Run the parser test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/parse-truck-html.test.ts
```

Expected: FAIL because `parseTruckHtml()` does not extract `performanceCheckUrl`.

- [ ] **Step 8: Implement performance link extraction**

In `src/v2/shared/lib/parse-truck-html.ts`, add this helper above `parseTruckHtml()`:

```ts
function normalizeOptionalUrl(href: string | undefined, baseUrl: string) {
  if (!href || href.trim().length === 0) {
    return undefined
  }

  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return undefined
  }
}

function extractPerformanceCheckUrl($: ReturnType<typeof load>, listingUrl: string) {
  const candidate = $('a')
    .toArray()
    .map((element) => {
      const link = $(element)
      const text = link.text().replace(/\s+/g, '')
      const href = link.attr('href')

      return {
        href,
        text,
      }
    })
    .find(
      ({ href, text }) =>
        text.includes('성능점검보기') ||
        href?.includes('CarCheck_Form') ||
        href?.includes('CheckPaper')
    )

  return normalizeOptionalUrl(candidate?.href, listingUrl)
}
```

Then include the field in the `truckListingSchema.parse({ ... })` object:

```ts
performanceCheckUrl: extractPerformanceCheckUrl($, url),
```

- [ ] **Step 9: Run parser and route tests**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/parse-truck-html.test.ts src/app/api/v2/parse-truck/__tests__/route.test.ts
```

Expected: parser tests PASS. The parse route test may still pass because it uses `expect.objectContaining`.

- [ ] **Step 10: Add an explicit parse route assertion**

In `src/app/api/v2/parse-truck/__tests__/route.test.ts`, add the same `성능점검보기` anchor to `listingHtml` and add this field to the `expect.objectContaining({ ... })` block:

```ts
performanceCheckUrl:
  'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
```

- [ ] **Step 11: Run the focused tests**

Run:

```bash
bun run test -- --run src/v2/entities/truck/__tests__/model.test.ts src/v2/shared/lib/__tests__/parse-truck-html.test.ts src/app/api/v2/parse-truck/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add package.json bun.lock src/v2/entities/truck/model.ts src/v2/entities/truck/__tests__/model.test.ts src/v2/shared/lib/parse-truck-html.ts src/v2/shared/lib/__tests__/parse-truck-html.test.ts src/app/api/v2/parse-truck/__tests__/route.test.ts
git commit -m "feat: 성능점검기록부 링크 파싱 추가"
```

## Task 2: Add Same-Origin CheckPaper Proxy Routes

**Files:**

- Create: `src/v2/shared/lib/checkpaper-proxy.ts`
- Create: `src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts`
- Create: `src/app/api/v2/checkpaper/route.ts`
- Create: `src/app/api/v2/checkpaper/__tests__/route.test.ts`
- Create: `src/app/api/v2/checkpaper/asset/route.ts`
- Create: `src/app/api/v2/checkpaper/asset/__tests__/route.test.ts`

- [ ] **Step 1: Write shared proxy helper tests**

Create `src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts`:

```ts
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
      isAllowedCheckPaperUrl('http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3')
    ).toBe(true)
    expect(isAllowedCheckPaperUrl('https://example.com/CheckPaper')).toBe(false)
  })

  it('builds encoded same-origin asset proxy URLs', () => {
    expect(toCheckPaperAssetProxyUrl('/assets/css/style_v2.css', finalUrl)).toBe(
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
      encodeURIComponent('https://checkpaper.jmenetworks.co.kr/assets/css/style_v2.css')
    )
    expect(rewritten).toContain(
      encodeURIComponent('https://checkpaper.jmenetworks.co.kr/assets/vendor/jquery/jquery.min.js')
    )
    expect(rewritten).toContain(
      encodeURIComponent('https://checkpaper.jmenetworks.co.kr/carimage/one.jpg')
    )
    expect(rewritten).toContain('action="/Service/CheckPaper"')
  })
})
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts
```

Expected: FAIL because `checkpaper-proxy.ts` does not exist.

- [ ] **Step 3: Implement shared proxy helpers**

Create `src/v2/shared/lib/checkpaper-proxy.ts`:

```ts
import { load } from 'cheerio'

const allowedCheckPaperHosts = new Set(['autocafe.co.kr', 'checkpaper.jmenetworks.co.kr'])

export function isAllowedCheckPaperUrl(value: string) {
  try {
    const url = new URL(value)

    return allowedCheckPaperHosts.has(url.hostname)
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
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write CheckPaper HTML route tests**

Create `src/app/api/v2/checkpaper/__tests__/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../route'

const intermediateUrl = 'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3'
const finalUrl =
  'https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107099659&print=0&iframe=1&key='

function createRequest(url: string) {
  return new Request(`http://localhost/api/v2/checkpaper?url=${encodeURIComponent(url)}`)
}

describe('GET /api/v2/checkpaper', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects missing and unsupported urls', async () => {
    await expect(GET(new Request('http://localhost/api/v2/checkpaper'))).resolves.toMatchObject({
      status: 400,
    })

    const response = await GET(createRequest('https://example.com/checkpaper'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toBe('성능점검기록부 주소를 확인하지 못했어요.')
  })

  it('fetches and rewrites a CheckPaper page', async () => {
    const fetchMock = vi.fn(async () => {
      const response = new Response(
        '<html><head><link href="/assets/css/style_v2.css"></head><body><div class="page">기록부</div></body></html>',
        {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }
      )
      Object.defineProperty(response, 'url', { value: finalUrl })

      return response
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(createRequest(intermediateUrl))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(fetchMock).toHaveBeenCalledWith(
      intermediateUrl,
      expect.objectContaining({ redirect: 'follow' })
    )
    expect(text).toContain('/api/v2/checkpaper/asset?url=')
    expect(text).toContain('class="page"')
  })

  it('returns a readable failure when the source does not respond', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 }))
    )

    const response = await GET(createRequest(intermediateUrl))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.message).toBe('성능점검기록부를 불러오지 못했어요.')
  })
})
```

- [ ] **Step 6: Implement the CheckPaper HTML route**

Create `src/app/api/v2/checkpaper/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { isAllowedCheckPaperUrl, rewriteCheckPaperHtml } from '@/v2/shared/lib/checkpaper-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 5

const failure = (status: number, message: string) =>
  NextResponse.json({ success: false, message }, { status })

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url).searchParams.get('url')

  if (!sourceUrl || !isAllowedCheckPaperUrl(sourceUrl)) {
    return failure(400, '성능점검기록부 주소를 확인하지 못했어요.')
  }

  try {
    const response = await fetch(sourceUrl, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    if (!response.ok) {
      return failure(502, '성능점검기록부를 불러오지 못했어요.')
    }

    const finalUrl = response.url || sourceUrl

    if (!isAllowedCheckPaperUrl(finalUrl)) {
      return failure(400, '성능점검기록부 주소를 확인하지 못했어요.')
    }

    return new NextResponse(rewriteCheckPaperHtml(await response.text(), finalUrl), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  } catch {
    return failure(502, '성능점검기록부를 불러오지 못했어요.')
  }
}
```

- [ ] **Step 7: Write and implement asset route tests**

Create `src/app/api/v2/checkpaper/asset/__tests__/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../route'

function createRequest(url: string) {
  return new Request(`http://localhost/api/v2/checkpaper/asset?url=${encodeURIComponent(url)}`)
}

describe('GET /api/v2/checkpaper/asset', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects unsupported asset hosts', async () => {
    const response = await GET(createRequest('https://example.com/style.css'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toBe('성능점검기록부 파일을 확인하지 못했어요.')
  })

  it('passes through allowed asset bytes and content type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('body { color: black; }', {
          status: 200,
          headers: { 'content-type': 'text/css' },
        })
      })
    )

    const response = await GET(
      createRequest('https://checkpaper.jmenetworks.co.kr/assets/css/style.css')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/css')
    await expect(response.text()).resolves.toBe('body { color: black; }')
  })
})
```

Create `src/app/api/v2/checkpaper/asset/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { isAllowedCheckPaperUrl } from '@/v2/shared/lib/checkpaper-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 5

const failure = (status: number, message: string) =>
  NextResponse.json({ success: false, message }, { status })

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url).searchParams.get('url')

  if (!sourceUrl || !isAllowedCheckPaperUrl(sourceUrl)) {
    return failure(400, '성능점검기록부 파일을 확인하지 못했어요.')
  }

  try {
    const response = await fetch(sourceUrl, {
      cache: 'no-store',
      redirect: 'follow',
    })

    if (!response.ok) {
      return failure(502, '성능점검기록부 파일을 불러오지 못했어요.')
    }

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'no-store',
      },
    })
  } catch {
    return failure(502, '성능점검기록부 파일을 불러오지 못했어요.')
  }
}
```

- [ ] **Step 8: Run route tests**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts src/app/api/v2/checkpaper/__tests__/route.test.ts src/app/api/v2/checkpaper/asset/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/v2/shared/lib/checkpaper-proxy.ts src/v2/shared/lib/__tests__/checkpaper-proxy.test.ts src/app/api/v2/checkpaper/route.ts src/app/api/v2/checkpaper/__tests__/route.test.ts src/app/api/v2/checkpaper/asset/route.ts src/app/api/v2/checkpaper/asset/__tests__/route.test.ts
git commit -m "feat: 성능점검기록부 프록시 추가"
```

## Task 3: Capture Proxied CheckPaper Pages As JPG Bytes

**Files:**

- Create: `src/v2/features/file-management/save-result.ts`
- Create: `src/v2/features/file-management/performance-check-capture.ts`
- Create: `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`
- Modify: `src/v2/features/file-management/index.ts`

- [ ] **Step 1: Define save result types**

Create `src/v2/features/file-management/save-result.ts`:

```ts
export type PerformanceCheckSaveStatus = 'saved' | 'missing'

export interface SaveTruckArtifactsResult {
  performanceCheckStatus: PerformanceCheckSaveStatus
  performanceCheckImageCount: number
}

export const missingPerformanceCheckResult: SaveTruckArtifactsResult = {
  performanceCheckStatus: 'missing',
  performanceCheckImageCount: 0,
}
```

- [ ] **Step 2: Write capture helper tests**

Create `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  capturePerformanceCheckPages,
  createPerformanceCheckProxyUrl,
} from '../performance-check-capture'

describe('performance check capture', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates the same-origin proxy URL for a source page', () => {
    expect(
      createPerformanceCheckProxyUrl('http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3')
    ).toBe(
      `/api/v2/checkpaper?url=${encodeURIComponent(
        'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3'
      )}`
    )
  })

  it('captures each rendered page as named JPG bytes', async () => {
    const pages = [document.createElement('section'), document.createElement('section')]
    const renderPage = vi.fn(async (_page: HTMLElement, index: number) => {
      return new Blob([`jpg-${index}`], { type: 'image/jpeg' })
    })

    const images = await capturePerformanceCheckPages(pages, { renderPage })

    expect(images).toHaveLength(2)
    expect(images[0]).toMatchObject({
      fileName: '성능점검기록부_1.jpg',
      contentType: 'image/jpeg',
    })
    await expect(new Blob([images[0].bytes]).text()).resolves.toBe('jpg-0')
    expect(renderPage).toHaveBeenCalledTimes(2)
  })

  it('returns an empty list when there are no rendered pages', async () => {
    await expect(
      capturePerformanceCheckPages([], {
        renderPage: vi.fn(),
      })
    ).resolves.toEqual([])
  })

  it('throws AbortError when aborted before capture starts', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      capturePerformanceCheckPages([document.createElement('section')], {
        signal: controller.signal,
        renderPage: vi.fn(),
      })
    ).rejects.toThrow('성능점검기록부 저장이 취소되었습니다.')
  })
})
```

- [ ] **Step 3: Run capture tests and verify they fail**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: FAIL because `performance-check-capture.ts` does not exist.

- [ ] **Step 4: Implement capture helpers and the production orchestrator**

Create `src/v2/features/file-management/performance-check-capture.ts`:

```ts
import html2canvas from 'html2canvas'

import { buildPerformanceCheckFileName } from './filename'

export interface PerformanceCheckImageFile {
  fileName: string
  bytes: Uint8Array
  contentType: 'image/jpeg'
}

interface CapturePerformanceCheckPagesOptions {
  signal?: AbortSignal
  renderPage?: (page: HTMLElement, index: number) => Promise<Blob>
}

interface CapturePerformanceCheckImagesOptions extends CapturePerformanceCheckPagesOptions {
  documentRef?: Document
  fetchHtml?: typeof fetch
}

export function createPerformanceCheckProxyUrl(url: string) {
  return `/api/v2/checkpaper?url=${encodeURIComponent(url)}`
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('성능점검기록부 저장이 취소되었습니다.', 'AbortError')
  }
}

async function blobToBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

async function defaultRenderPage(page: HTMLElement) {
  const canvas = await html2canvas(page, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) {
          resolve(value)
          return
        }

        reject(new Error('성능점검기록부 이미지를 만들지 못했어요.'))
      },
      'image/jpeg',
      0.92
    )
  })

  return blob
}

export async function capturePerformanceCheckPages(
  pages: readonly HTMLElement[],
  { renderPage = defaultRenderPage, signal }: CapturePerformanceCheckPagesOptions = {}
): Promise<PerformanceCheckImageFile[]> {
  const images: PerformanceCheckImageFile[] = []

  for (const [index, page] of pages.entries()) {
    assertNotAborted(signal)
    const blob = await renderPage(page, index)
    assertNotAborted(signal)
    images.push({
      fileName: buildPerformanceCheckFileName(index),
      bytes: await blobToBytes(blob),
      contentType: 'image/jpeg',
    })
  }

  return images
}

function waitForFrameLoad(iframe: HTMLIFrameElement, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    assertNotAborted(signal)

    const cleanup = () => {
      iframe.removeEventListener('load', onLoad)
      signal?.removeEventListener('abort', onAbort)
    }
    const onLoad = () => {
      cleanup()
      resolve()
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('성능점검기록부 저장이 취소되었습니다.', 'AbortError'))
    }

    iframe.addEventListener('load', onLoad, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function waitForImages(documentRef: Document, signal?: AbortSignal) {
  const images = Array.from(documentRef.images)

  await Promise.all(
    images.map((image) => {
      if (image.complete) {
        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        assertNotAborted(signal)
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    })
  )
}

export async function capturePerformanceCheckImages(
  performanceCheckUrl: string,
  {
    documentRef = document,
    fetchHtml = fetch,
    renderPage,
    signal,
  }: CapturePerformanceCheckImagesOptions = {}
) {
  assertNotAborted(signal)
  const response = await fetchHtml(createPerformanceCheckProxyUrl(performanceCheckUrl), {
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    return []
  }

  const iframe = documentRef.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '900px'
  iframe.style.height = '1300px'
  iframe.setAttribute('aria-hidden', 'true')

  documentRef.body.appendChild(iframe)

  try {
    iframe.srcdoc = await response.text()
    await waitForFrameLoad(iframe, signal)

    const frameDocument = iframe.contentDocument

    if (!frameDocument) {
      return []
    }

    await waitForImages(frameDocument, signal)
    const pages = Array.from(frameDocument.querySelectorAll<HTMLElement>('.page'))

    return await capturePerformanceCheckPages(pages, { renderPage, signal })
  } finally {
    iframe.remove()
  }
}
```

- [ ] **Step 5: Export the capture helpers**

In `src/v2/features/file-management/index.ts`, add:

```ts
export {
  capturePerformanceCheckImages,
  capturePerformanceCheckPages,
  createPerformanceCheckProxyUrl,
} from './performance-check-capture'
export type { PerformanceCheckImageFile } from './performance-check-capture'
export {
  missingPerformanceCheckResult,
  type PerformanceCheckSaveStatus,
  type SaveTruckArtifactsResult,
} from './save-result'
```

- [ ] **Step 6: Run capture tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/v2/features/file-management/save-result.ts src/v2/features/file-management/performance-check-capture.ts src/v2/features/file-management/__tests__/performance-check-capture.test.ts src/v2/features/file-management/index.ts
git commit -m "feat: 성능점검기록부 이미지 캡처 추가"
```

## Task 4: Save The New Folder Structure To Directory And ZIP

**Files:**

- Modify: `src/v2/features/file-management/filename.ts`
- Modify: `src/v2/features/file-management/__tests__/filename.test.ts`
- Modify: `src/v2/features/file-management/file-system.ts`
- Modify: `src/v2/features/file-management/__tests__/file-system.test.ts`
- Modify: `src/v2/features/file-management/zip-fallback.ts`
- Modify: `src/v2/features/file-management/__tests__/zip-fallback.test.ts`
- Modify: `src/v2/features/file-management/text-content.ts`

- [ ] **Step 1: Write filename tests for the new structure**

In `src/v2/features/file-management/__tests__/filename.test.ts`, update the import:

```ts
import {
  buildImageFileName,
  buildPerformanceCheckFileName,
  buildTextFileName,
  buildTruckFolderName,
  fileManagementFolderNames,
} from '../filename'
```

Replace the legacy image file name test with:

```ts
it('builds user-readable image and performance check file names', () => {
  expect(buildImageFileName(0)).toBe('사진_1.jpg')
  expect(buildImageFileName(8)).toBe('사진_9.jpg')
  expect(buildImageFileName(99)).toBe('사진_100.jpg')
  expect(buildPerformanceCheckFileName(0)).toBe('성능점검기록부_1.jpg')
  expect(buildPerformanceCheckFileName(1)).toBe('성능점검기록부_2.jpg')
})
```

Update the text filename assertion:

```ts
expect(buildTextFileName('12가/3456:*?')).toBe('차량정보.txt')
```

Add:

```ts
it('exposes the vehicle subfolder names', () => {
  expect(fileManagementFolderNames).toEqual({
    images: '차량 이미지',
    performanceCheck: '성능점검기록부',
    text: '원고',
  })
})
```

- [ ] **Step 2: Run filename tests and verify they fail**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/filename.test.ts
```

Expected: FAIL because filenames still use `K-001.jpg` and `차량번호 원고.txt`.

- [ ] **Step 3: Implement filename builders**

Replace `src/v2/features/file-management/filename.ts` with:

```ts
const unsafeFileNameCharacters = /[<>:"/\\|?*]/g
const emptyVehicleNumberFallback = '차량번호_없음'

export const fileManagementFolderNames = {
  images: '차량 이미지',
  performanceCheck: '성능점검기록부',
  text: '원고',
} as const

export function buildImageFileName(index: number) {
  return `사진_${index + 1}.jpg`
}

export function buildPerformanceCheckFileName(index: number) {
  return `성능점검기록부_${index + 1}.jpg`
}

export function buildTruckFolderName(vehicleNumber: string) {
  const sanitized = vehicleNumber.trim().replace(unsafeFileNameCharacters, '_')
  return sanitized || emptyVehicleNumberFallback
}

export function buildTextFileName(_vehicleNumber: string) {
  return '차량정보.txt'
}
```

- [ ] **Step 4: Run filename and text-content tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/filename.test.ts src/v2/features/file-management/__tests__/file-system.test.ts
```

Expected: filename tests PASS. File-system tests FAIL because the folder structure is still flat.

- [ ] **Step 5: Update text content image references**

In `src/v2/features/file-management/text-content.ts`, no function signature changes are needed. Keep using `buildImageFileName(index)` so the text content now references `#사진:사진_1.jpg`, `#사진:사진_2.jpg`, and so on.

- [ ] **Step 6: Update directory save tests**

In `src/v2/features/file-management/__tests__/file-system.test.ts`, update `createDirectoryHandle()` so it can create named child directories:

```ts
function createDirectoryHandle() {
  const writables = new Map<string, ReturnType<typeof createWritable>>()
  const getFileHandle = vi.fn(async (name: string) => {
    const writable = createWritable()
    writables.set(name, writable)
    return {
      createWritable: vi.fn(async () => writable),
    }
  })
  const childDirectories = new Map<
    string,
    { getDirectoryHandle: ReturnType<typeof vi.fn>; getFileHandle: typeof getFileHandle }
  >()
  const createChildDirectory = () => ({
    getDirectoryHandle: vi.fn(async (name: string) => {
      const child = createChildDirectory()
      childDirectories.set(name, child)
      return child
    }),
    getFileHandle,
  })
  const vehicleDirectory = createChildDirectory()
  const rootDirectory = {
    getDirectoryHandle: vi.fn(async () => vehicleDirectory),
  }

  return {
    rootDirectory: rootDirectory as unknown as WritableDirectoryHandle,
    vehicleDirectory,
    childDirectories,
    writables,
  }
}
```

Replace the main save test expectations with:

```ts
expect(rootDirectory.getDirectoryHandle).toHaveBeenCalledWith('12가_3456', {
  create: true,
})
expect(vehicleDirectory.getDirectoryHandle).toHaveBeenCalledWith('차량 이미지', {
  create: true,
})
expect(vehicleDirectory.getDirectoryHandle).toHaveBeenCalledWith('원고', {
  create: true,
})
expect(vehicleDirectory.getDirectoryHandle).toHaveBeenCalledWith('성능점검기록부', { create: true })
expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith('사진_1.jpg', {
  create: true,
})
expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith('사진_2.jpg', {
  create: true,
})
expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith('차량정보.txt', {
  create: true,
})
expect(writables.get('차량정보.txt')!.write).toHaveBeenCalledWith(
  expect.stringContaining('차량번호 :  12가/3456')
)
```

Add this test:

```ts
it('saves performance check images when they can be captured', async () => {
  const listingWithCheck = {
    ...listing,
    performanceCheckUrl: 'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
  }
  const capturePerformanceCheckImages = vi.fn(async () => [
    {
      fileName: '성능점검기록부_1.jpg',
      bytes: new Uint8Array(await new Response('check-1').arrayBuffer()),
      contentType: 'image/jpeg' as const,
    },
  ])
  stubFetch(vi.fn(async () => new Response('image-bytes')) as typeof fetch)
  const { rootDirectory, vehicleDirectory, writables } = createDirectoryHandle()

  const result = await saveTruckToDirectory(rootDirectory, listingWithCheck, {
    capturePerformanceCheckImages,
  })

  expect(result).toEqual({
    performanceCheckStatus: 'saved',
    performanceCheckImageCount: 1,
  })
  expect(capturePerformanceCheckImages).toHaveBeenCalledWith(
    listingWithCheck.performanceCheckUrl,
    expect.objectContaining({ signal: undefined })
  )
  expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith('성능점검기록부_1.jpg', {
    create: true,
  })
  await expect(writables.get('성능점검기록부_1.jpg')!.write).toHaveBeenCalledWith(
    new Uint8Array(await new Response('check-1').arrayBuffer())
  )
})
```

Add this test:

```ts
it('keeps vehicle save successful when performance check capture fails', async () => {
  const listingWithCheck = {
    ...listing,
    performanceCheckUrl: 'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
  }
  stubFetch(vi.fn(async () => new Response('image-bytes')) as typeof fetch)
  const { rootDirectory, vehicleDirectory } = createDirectoryHandle()

  const result = await saveTruckToDirectory(rootDirectory, listingWithCheck, {
    capturePerformanceCheckImages: vi.fn(async () => {
      throw new Error('check unavailable')
    }),
  })

  expect(result).toEqual({
    performanceCheckStatus: 'missing',
    performanceCheckImageCount: 0,
  })
  expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith('차량정보.txt', {
    create: true,
  })
})
```

- [ ] **Step 7: Modify directory saving**

In `src/v2/features/file-management/file-system.ts`, update imports:

```ts
import {
  buildImageFileName,
  buildTextFileName,
  buildTruckFolderName,
  fileManagementFolderNames,
} from './filename'
import {
  capturePerformanceCheckImages as defaultCapturePerformanceCheckImages,
  type PerformanceCheckImageFile,
} from './performance-check-capture'
import { missingPerformanceCheckResult, type SaveTruckArtifactsResult } from './save-result'
```

Update `SaveTruckToDirectoryOptions`:

```ts
interface SaveTruckToDirectoryOptions {
  capturePerformanceCheckImages?: typeof defaultCapturePerformanceCheckImages
  onProgress?: (progress: number, downloaded: number, total: number) => void
  signal?: AbortSignal
}
```

Add helpers:

```ts
async function writePerformanceCheckImages(
  vehicleDirectory: WritableDirectoryHandle,
  images: readonly PerformanceCheckImageFile[]
) {
  if (images.length === 0) {
    return missingPerformanceCheckResult
  }

  const performanceDirectory = await vehicleDirectory.getDirectoryHandle(
    fileManagementFolderNames.performanceCheck,
    { create: true }
  )

  for (const image of images) {
    await writeFile(performanceDirectory, image.fileName, image.bytes)
  }

  return {
    performanceCheckStatus: 'saved' as const,
    performanceCheckImageCount: images.length,
  }
}
```

Change `saveTruckToDirectory()` signature and folder creation:

```ts
export async function saveTruckToDirectory(
  rootDirectory: WritableDirectoryHandle,
  truck: TruckListing,
  {
    capturePerformanceCheckImages = defaultCapturePerformanceCheckImages,
    onProgress,
    signal,
  }: SaveTruckToDirectoryOptions = {}
): Promise<SaveTruckArtifactsResult> {
  assertNotAborted(signal)

  const vehicleDirectory = await rootDirectory.getDirectoryHandle(
    buildTruckFolderName(truck.vnumber),
    { create: true }
  )
  const imageDirectory = await vehicleDirectory.getDirectoryHandle(
    fileManagementFolderNames.images,
    { create: true }
  )
  const textDirectory = await vehicleDirectory.getDirectoryHandle(
    fileManagementFolderNames.text,
    { create: true }
  )
```

Write vehicle images to `imageDirectory` and text to `textDirectory`:

```ts
await writeFile(imageDirectory, buildImageFileName(index), imageBytes)
```

```ts
await writeFile(textDirectory, buildTextFileName(truck.vnumber), buildTruckTextContent(truck))
```

Before writing text, add the non-fatal performance check save:

```ts
let performanceCheckResult = missingPerformanceCheckResult

if (truck.performanceCheckUrl) {
  try {
    const performanceImages = await capturePerformanceCheckImages(truck.performanceCheckUrl, {
      signal,
    })
    assertNotAborted(signal)
    performanceCheckResult = await writePerformanceCheckImages(vehicleDirectory, performanceImages)
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }

    performanceCheckResult = missingPerformanceCheckResult
  }
}
```

At the end, return:

```ts
return performanceCheckResult
```

- [ ] **Step 8: Run directory tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/filename.test.ts src/v2/features/file-management/__tests__/file-system.test.ts
```

Expected: PASS.

- [ ] **Step 9: Update ZIP tests**

In `src/v2/features/file-management/__tests__/zip-fallback.test.ts`, update the first test expected files:

```ts
expect(zip.file('12가_3456/원고/차량정보.txt')).toBeTruthy()
expect(zip.file('12가_3456/차량 이미지/사진_1.jpg')).toBeTruthy()
expect(zip.file('12가_3456/차량 이미지/사진_2.jpg')).toBeTruthy()
```

Add this test:

```ts
it('adds captured performance check images to each truck folder', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('image-bytes', { status: 200 }))
  )

  const zipPackage = await createTruckZipPackage(
    [
      {
        ...listing,
        performanceCheckUrl: 'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
      },
    ],
    {
      capturePerformanceCheckImages: vi.fn(async () => [
        {
          fileName: '성능점검기록부_1.jpg',
          bytes: new Uint8Array(await new Response('check-1').arrayBuffer()),
          contentType: 'image/jpeg' as const,
        },
      ]),
    }
  )
  const zip = await JSZip.loadAsync(zipPackage.blob)

  expect(zipPackage.results).toEqual([
    {
      performanceCheckStatus: 'saved',
      performanceCheckImageCount: 1,
    },
  ])
  await expect(
    zip.file('12가_3456/성능점검기록부/성능점검기록부_1.jpg')!.async('string')
  ).resolves.toBe('check-1')
})
```

- [ ] **Step 10: Modify ZIP implementation**

In `src/v2/features/file-management/zip-fallback.ts`, add imports:

```ts
import { capturePerformanceCheckImages as defaultCapturePerformanceCheckImages } from './performance-check-capture'
import { missingPerformanceCheckResult, type SaveTruckArtifactsResult } from './save-result'
```

Update options:

```ts
interface CreateTruckZipBlobOptions {
  capturePerformanceCheckImages?: typeof defaultCapturePerformanceCheckImages
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}
```

Add a package interface:

```ts
export interface TruckZipPackage {
  blob: Blob
  results: SaveTruckArtifactsResult[]
}
```

Create `createTruckZipPackage()` and keep `createTruckZipBlob()` as a compatibility wrapper:

```ts
export async function createTruckZipPackage(
  trucks: readonly TruckListing[],
  {
    capturePerformanceCheckImages = defaultCapturePerformanceCheckImages,
    onProgress,
    signal,
  }: CreateTruckZipBlobOptions = {}
): Promise<TruckZipPackage> {
  const zip = new JSZip()
  const results: SaveTruckArtifactsResult[] = []

  for (const [truckIndex, truck] of trucks.entries()) {
    assertNotAborted(signal)

    const folder = zip.folder(buildTruckFolderName(truck.vnumber))

    if (!folder) {
      results.push(missingPerformanceCheckResult)
      continue
    }

    const imageFolder = folder.folder(fileManagementFolderNames.images)
    const performanceFolder = folder.folder(fileManagementFolderNames.performanceCheck)
    const textFolder = folder.folder(fileManagementFolderNames.text)

    textFolder?.file(buildTextFileName(truck.vnumber), buildTruckTextContent(truck))

    for (const [imageIndex, imageUrl] of truck.images.entries()) {
      assertNotAborted(signal)

      try {
        const imageBytes = await fetchImageBytes(imageUrl, signal)

        assertNotAborted(signal)
        imageFolder?.file(buildImageFileName(imageIndex), imageBytes)
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }

        assertNotAborted(signal)
      }
    }

    let performanceCheckResult = missingPerformanceCheckResult

    if (truck.performanceCheckUrl) {
      try {
        const performanceImages = await capturePerformanceCheckImages(truck.performanceCheckUrl, {
          signal,
        })

        performanceImages.forEach((image) => {
          performanceFolder?.file(image.fileName, image.bytes)
        })
        performanceCheckResult =
          performanceImages.length > 0
            ? {
                performanceCheckStatus: 'saved',
                performanceCheckImageCount: performanceImages.length,
              }
            : missingPerformanceCheckResult
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }
      }
    }

    results.push(performanceCheckResult)

    assertNotAborted(signal)
    onProgress?.(Math.round(((truckIndex + 1) / trucks.length) * 100))
  }

  assertNotAborted(signal)
  const blob = await zip.generateAsync({ type: 'blob' })

  assertNotAborted(signal)
  return { blob, results }
}

export async function createTruckZipBlob(
  trucks: readonly TruckListing[],
  options: CreateTruckZipBlobOptions = {}
) {
  const zipPackage = await createTruckZipPackage(trucks, options)

  return zipPackage.blob
}
```

Update `downloadTruckZip()` to return results:

```ts
const zipPackage = await createTruckZipPackage(trucks, options)
const blob = zipPackage.blob
```

At the end:

```ts
return zipPackage.results
```

- [ ] **Step 11: Export ZIP package helper**

In `src/v2/features/file-management/index.ts`, update ZIP exports:

```ts
export { createTruckZipBlob, createTruckZipPackage, downloadTruckZip } from './zip-fallback'
export type { TruckZipPackage } from './zip-fallback'
```

- [ ] **Step 12: Run file-management tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src/v2/features/file-management/filename.ts src/v2/features/file-management/__tests__/filename.test.ts src/v2/features/file-management/file-system.ts src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/zip-fallback.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts src/v2/features/file-management/text-content.ts src/v2/features/file-management/index.ts
git commit -m "feat: 차량 저장 폴더 구조 개선"
```

## Task 5: Surface Low-Noise Missing Performance Check Notices

**Files:**

- Modify: `src/v2/features/listing-preparation/model/prepared-listing-store.ts`
- Modify: `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`
- Modify: `src/v2/application/truck-harvester-workflow/save-workflow.ts`
- Modify: `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`
- Modify: `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`
- Modify: `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`

- [ ] **Step 1: Write store tests for save result metadata**

In `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`, add:

```ts
it('keeps missing performance check status on saved items', () => {
  const store = createPreparedListingStore()
  store.getState().addUrls([firstUrl])
  store.getState().markReady(firstUrl, listing)

  store.getState().markSaved('listing-1', {
    performanceCheckStatus: 'missing',
    performanceCheckImageCount: 0,
  })

  expect(store.getState().items[0]).toMatchObject({
    status: 'saved',
    performanceCheckStatus: 'missing',
    performanceCheckImageCount: 0,
  })
})
```

- [ ] **Step 2: Run store tests and verify they fail**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts
```

Expected: FAIL because `markSaved()` does not accept save result metadata.

- [ ] **Step 3: Update prepared listing state**

In `src/v2/features/listing-preparation/model/prepared-listing-store.ts`, import:

```ts
import {
  missingPerformanceCheckResult,
  type SaveTruckArtifactsResult,
} from '@/v2/features/file-management'
```

Add the optional fields to `SavingPreparedListing` and `SavedPreparedListing`:

```ts
performanceCheckStatus?: SaveTruckArtifactsResult['performanceCheckStatus']
performanceCheckImageCount?: number
```

Update the action type:

```ts
markSaved: (id: string, result?: SaveTruckArtifactsResult) => void
```

Update `markSaved` implementation:

```ts
markSaved: (id, result = missingPerformanceCheckResult) =>
  set((state) => ({
    items: updateById(state.items, id, (item) => {
      const totalImages = getSavedTotalImages(item)

      return {
        status: 'saved',
        id: item.id,
        url: item.url,
        label: item.label,
        listing: getListing(item),
        downloadedImages: totalImages,
        totalImages,
        progress: 100,
        performanceCheckStatus: result.performanceCheckStatus,
        performanceCheckImageCount: result.performanceCheckImageCount,
      }
    }),
  })),
```

- [ ] **Step 4: Run store tests**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write workflow tests for directory and ZIP results**

In `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`, update the first directory save mock:

```ts
const saveTruckToDirectory = vi.fn(async () => ({
  performanceCheckStatus: 'missing' as const,
  performanceCheckImageCount: 0,
}))
```

Add to the saved item expectation:

```ts
performanceCheckStatus: 'missing',
performanceCheckImageCount: 0,
```

In the ZIP saving test, update the mock:

```ts
const downloadTruckZip = vi.fn(async () => [
  {
    performanceCheckStatus: 'missing' as const,
    performanceCheckImageCount: 0,
  },
])
```

Add the same saved item expectation.

- [ ] **Step 6: Update save workflow implementation**

In `src/v2/application/truck-harvester-workflow/save-workflow.ts`, directory branch:

```ts
const saveResult = await saveTruckToDirectory(directory, item.listing, {
  signal,
  onProgress: (progress, downloadedImages, totalImages) => {
    if (isAborted(signal)) {
      return
    }

    store.getState().markSaving(item.id, {
      downloadedImages,
      totalImages,
      progress,
    })
  },
})
```

Then:

```ts
store.getState().markSaved(item.id, saveResult)
```

ZIP branch:

```ts
const saveResults = await downloadTruckZip(
  items.map((item) => item.listing),
  {
    signal,
    onProgress: (progress) => {
      if (isAborted(signal)) {
        return
      }

      items.forEach((item) => {
        store.getState().markSaving(item.id, {
          downloadedImages: 0,
          totalImages: item.listing.images.length,
          progress,
        })
      })
    },
  }
)
```

Then:

```ts
items.forEach((item, index) => {
  store.getState().markSaved(item.id, saveResults[index])
  savedItemIds.add(item.id)
})
```

- [ ] **Step 7: Run workflow tests**

Run:

```bash
bun run test -- --run src/v2/application/truck-harvester-workflow/save-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 8: Write status panel tests**

In `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`, add:

```ts
it('shows one low-noise notice when a saved listing is missing a performance check', () => {
  const html = renderToStaticMarkup(
    <PreparedListingStatusPanel
      items={[
        {
          status: 'saved',
          id: 'listing-1',
          url: `${baseUrl}3`,
          label: '현대 메가트럭',
          listing,
          downloadedImages: 2,
          totalImages: 2,
          progress: 100,
          performanceCheckStatus: 'missing',
          performanceCheckImageCount: 0,
        },
      ]}
    />
  )

  expect(html).toContain('1대 저장 완료')
  expect(html).toContain(
    '다만 성능점검기록부를 찾지 못한 차량이 1대 있어요.'
  )
  expect(html).toContain('성능점검기록부 확인 필요')
  expect(html).not.toContain('캡처')
  expect(html).not.toContain('proxy')
  expect(html).not.toContain('HTML')
  expect(html).not.toContain('API')
})
```

- [ ] **Step 9: Implement the status panel notice**

In `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`, add helper:

```ts
const getMissingPerformanceCheckCount = (items: readonly PreparedListing[]) =>
  items.filter((item) => item.status === 'saved' && item.performanceCheckStatus === 'missing')
    .length
```

Inside `PreparedListingStatusPanel`, after `const summary = getSummary(items)`, add:

```ts
const missingPerformanceCheckCount = getMissingPerformanceCheckCount(items)
```

Render this below the summary paragraph:

```tsx
{
  missingPerformanceCheckCount > 0 ? (
    <p className="text-muted-foreground text-sm">
      다만 성능점검기록부를 찾지 못한 차량이 {missingPerformanceCheckCount}대 있어요. 스마트스토어에
      올리기 전에 해당 차량 폴더를 한 번 확인해 주세요.
    </p>
  ) : null
}
```

Update `PreparedListingMessage()`:

```tsx
if (item.status === 'saved' && item.performanceCheckStatus === 'missing') {
  return <p className="text-muted-foreground text-sm">성능점검기록부 확인 필요</p>
}
```

- [ ] **Step 10: Run status panel tests**

Run:

```bash
bun run test -- --run src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Run connected workflow and UI tests**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts src/v2/application/truck-harvester-workflow/save-workflow.test.ts src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/v2/features/listing-preparation/model/prepared-listing-store.ts src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts src/v2/application/truck-harvester-workflow/save-workflow.ts src/v2/application/truck-harvester-workflow/save-workflow.test.ts src/v2/widgets/processing-status/ui/prepared-listing-status.tsx src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx
git commit -m "feat: 성능점검기록부 누락 안내 추가"
```

## Task 6: Final Verification And Regression Sweep

**Files:**

- Modify only if failures reveal a direct issue in files touched by Tasks 1-5.

- [ ] **Step 1: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 3: Run format check**

Run:

```bash
bun run format:check
```

Expected: PASS.

- [ ] **Step 4: Run the focused unit suites**

Run:

```bash
bun run test -- --run src/v2/entities/truck src/v2/shared/lib src/app/api/v2 src/v2/features/file-management src/v2/features/listing-preparation/model src/v2/application/truck-harvester-workflow src/v2/widgets/processing-status/ui
```

Expected: PASS.

- [ ] **Step 5: Run all unit tests**

Run:

```bash
bun run test -- --run
```

Expected: PASS.

- [ ] **Step 6: Run build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 7: Smoke test the app manually**

Run:

```bash
bun dev
```

Open `/`, paste a supported `truck-no1.co.kr/model/DetailView.asp?...` address, wait until it is ready, save to a test folder, and inspect the folder.

Expected folder shape:

```text
차량번호/
  차량 이미지/
    사진_1.jpg
  성능점검기록부/
    성능점검기록부_1.jpg
  원고/
    차량정보.txt
```

If the performance check cannot be created, expected UI copy:

```text
다만 성능점검기록부를 찾지 못한 차량이 1대 있어요.
스마트스토어에 올리기 전에 해당 차량 폴더를 한 번 확인해 주세요.
```

- [ ] **Step 8: Stop the dev server**

Press `Ctrl+C` in the `bun dev` terminal session.

- [ ] **Step 9: Review final diff**

Run:

```bash
git status --short
git log --oneline origin/main..HEAD
```

Expected: working tree clean, with the implementation commits ahead of `origin/main`.

- [ ] **Step 10: Finish with a clean tree**

Run:

```bash
git status --short
```

Expected: no output. If any files are listed, inspect them with `git diff`,
finish the direct fix in the relevant task's file set, rerun the matching
verification command above, and commit only those files with the same commit
style used in Tasks 1-5.
