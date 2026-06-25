# Carmodoo Native Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Carmodoo performance-check `html2canvas` path with a native Chromium screenshot renderer while preserving the existing save flow.

**Architecture:** Keep `capturePerformanceCheckImages()` as the public client contract that returns `Uint8Array[]`. Route Carmodoo `checkNum` URLs to a new same-origin API route that validates the URL, opens the proxied Carmodoo document in Chromium, screenshots each 2-up `.page_wrap`, and returns base64 JPGs. Keep CheckPaper PDF rendering unchanged and keep renderer failures non-fatal in the existing file-system and ZIP save layers.

**Tech Stack:** Next.js App Router route handlers, TypeScript strict mode, Playwright/Chromium, Vitest, existing CheckPaper proxy helpers, existing file-system and ZIP save adapters.

---

## Scope Check

This is one subsystem: performance-check rendering for Carmodoo HTML records. It does not redesign the UI, change analytics, automate SmartStore upload, or replace the existing CheckPaper PDF renderer.

## File Structure

- Create `src/v2/shared/lib/carmodoo-performance-check.ts`
  - Owns Carmodoo URL validation and native-render response contracts used by both client capture code and server routes.
- Create `src/v2/shared/lib/__tests__/carmodoo-performance-check.test.ts`
  - Proves URL validation and response decoding rules without browser dependencies.
- Create `src/v2/features/file-management/server/carmodoo-native-renderer.ts`
  - Server-only Playwright renderer. Opens the existing proxied CheckPaper route, waits for Carmodoo sheets, screenshots them as JPG, and cleans up browser resources.
- Create `src/v2/features/file-management/server/__tests__/carmodoo-native-renderer.test.ts`
  - Uses fake browser/page objects to prove renderer orchestration and cleanup without launching real Chromium.
- Create `src/app/api/v2/checkpaper/carmodoo-render/route.ts`
  - POST API that validates request JSON, calls the server renderer, and returns base64 JPGs.
- Create `src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts`
  - Tests request validation and renderer success/failure responses with an injected fake renderer.
- Modify `src/v2/features/file-management/performance-check-capture.ts`
  - Replace the Carmodoo `html2canvas` provider with a `carmodoo-native` provider that calls the new API route.
- Modify `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`
  - Replace Carmodoo iframe/html2canvas tests with native renderer API client tests.
- Modify `package.json` and `bun.lock`
  - Add Playwright as a runtime dependency if direct server imports require it.
- Modify `docs/architecture.md`
  - Update CheckPaper Integration wording to say Carmodoo uses a native renderer API.

## Task 1: Add Carmodoo URL And Render Response Contracts

**Files:**

- Create: `src/v2/shared/lib/carmodoo-performance-check.ts`
- Create: `src/v2/shared/lib/__tests__/carmodoo-performance-check.test.ts`

- [ ] **Step 1: Write the failing URL and response contract tests**

Create `src/v2/shared/lib/__tests__/carmodoo-performance-check.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  CARMODOO_RENDER_MAX_PAGE_COUNT,
  decodeCarmodooNativeRenderResponse,
  isCarmodooPrintUrl,
} from '../carmodoo-performance-check'

const carmodooUrl = 'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

describe('carmodoo-performance-check', () => {
  it('accepts Carmodoo print URLs with checkNum', () => {
    expect(isCarmodooPrintUrl(new URL(carmodooUrl))).toBe(true)
  })

  it('rejects Carmodoo URLs without checkNum', () => {
    expect(
      isCarmodooPrintUrl(new URL('https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0'))
    ).toBe(false)
  })

  it('rejects unsupported hosts and paths', () => {
    expect(
      isCarmodooPrintUrl(
        new URL('https://example.com/carCheck/carmodooPrint.do?checkNum=7126000658')
      )
    ).toBe(false)
    expect(
      isCarmodooPrintUrl(new URL('https://ck.carmodoo.com/other.do?checkNum=7126000658'))
    ).toBe(false)
  })

  it('decodes base64 JPG render responses to byte arrays', () => {
    const first = Buffer.from([1, 2, 3]).toString('base64')
    const second = Buffer.from([4, 5]).toString('base64')

    expect(
      decodeCarmodooNativeRenderResponse({
        images: [first, second],
      })
    ).toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])])
  })

  it('rejects malformed render responses', () => {
    expect(() => decodeCarmodooNativeRenderResponse({})).toThrow(
      '성능점검기록부 이미지를 만들지 못했습니다.'
    )
    expect(() =>
      decodeCarmodooNativeRenderResponse({
        images: Array.from({ length: CARMODOO_RENDER_MAX_PAGE_COUNT + 1 }, () =>
          Buffer.from([1]).toString('base64')
        ),
      })
    ).toThrow('성능점검기록부 이미지 수가 올바르지 않습니다.')
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/carmodoo-performance-check.test.ts
```

Expected: FAIL because `src/v2/shared/lib/carmodoo-performance-check.ts` does not exist.

- [ ] **Step 3: Add the shared Carmodoo contract helper**

Create `src/v2/shared/lib/carmodoo-performance-check.ts`:

```ts
export const CARMODOO_RENDER_MAX_PAGE_COUNT = 4

export type CarmodooNativeRenderResponse = {
  images: string[]
}

export function isCarmodooPrintUrl(url: URL) {
  return (
    url.hostname === 'ck.carmodoo.com' &&
    url.pathname.toLowerCase() === '/carcheck/carmodooprint.do' &&
    Boolean(url.searchParams.get('checkNum')?.trim())
  )
}

function decodeBase64ToBytes(value: string) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function decodeCarmodooNativeRenderResponse(value: unknown): Uint8Array[] {
  if (!value || typeof value !== 'object' || !('images' in value) || !Array.isArray(value.images)) {
    throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
  }

  if (value.images.length === 0 || value.images.length > CARMODOO_RENDER_MAX_PAGE_COUNT) {
    throw new Error('성능점검기록부 이미지 수가 올바르지 않습니다.')
  }

  if (!value.images.every((image): image is string => typeof image === 'string')) {
    throw new Error('성능점검기록부 이미지를 만들지 못했습니다.')
  }

  return value.images.map(decodeBase64ToBytes)
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/carmodoo-performance-check.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/shared/lib/carmodoo-performance-check.ts src/v2/shared/lib/__tests__/carmodoo-performance-check.test.ts
git commit -m "test: 카모두 native renderer 계약 추가"
```

## Task 2: Add The Carmodoo Native Render API Route Contract

**Files:**

- Create: `src/app/api/v2/checkpaper/carmodoo-render/route.ts`
- Create: `src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing route tests with an injected renderer**

Create `src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPostHandler, maxDuration } from '../route'

const carmodooUrl = 'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

function createRequest(body: unknown) {
  return new Request('http://localhost/api/v2/checkpaper/carmodoo-render', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

describe('POST /api/v2/checkpaper/carmodoo-render', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a render budget long enough for Chromium startup', () => {
    expect(maxDuration).toBeGreaterThanOrEqual(15)
  })

  it('renders Carmodoo URLs and returns base64 JPG images', async () => {
    const render = vi.fn(async () => [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])])
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url: carmodooUrl }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      images: [Buffer.from([1, 2, 3]).toString('base64'), Buffer.from([4, 5]).toString('base64')],
    })
    expect(render).toHaveBeenCalledWith(carmodooUrl, {
      origin: 'http://localhost',
    })
  })

  it('rejects missing and unsupported URLs before calling renderer', async () => {
    const render = vi.fn()
    const POST = createPostHandler({ render })

    const missingResponse = await POST(createRequest({}))
    const unsupportedResponse = await POST(createRequest({ url: 'https://example.com/report' }))

    expect(missingResponse.status).toBe(400)
    expect(await missingResponse.json()).toEqual({
      success: false,
      message: '성능점검기록부 주소를 확인하지 못했어요.',
    })
    expect(unsupportedResponse.status).toBe(400)
    expect(render).not.toHaveBeenCalled()
  })

  it('returns a quiet Korean error when rendering fails', async () => {
    const render = vi.fn(async () => {
      throw new Error('browser failed')
    })
    const POST = createPostHandler({ render })

    const response = await POST(createRequest({ url: carmodooUrl }))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      message: '성능점검기록부를 불러오지 못했어요.',
    })
  })
})
```

- [ ] **Step 2: Run the focused route test and verify it fails**

Run:

```bash
bun run test -- --run src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Add the route with injectable renderer**

Create `src/app/api/v2/checkpaper/carmodoo-render/route.ts`:

```ts
import { NextResponse } from 'next/server'

import {
  CARMODOO_RENDER_MAX_PAGE_COUNT,
  isCarmodooPrintUrl,
} from '@/v2/shared/lib/carmodoo-performance-check'
import { renderCarmodooNativeImages } from '@/v2/features/file-management/server/carmodoo-native-renderer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 15

type CarmodooRenderer = (url: string, options: { origin: string }) => Promise<Uint8Array[]>

function createErrorResponse(status: number, message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    }
  )
}

async function readRequestUrl(request: Request) {
  try {
    const body = (await request.json()) as unknown

    if (!body || typeof body !== 'object' || !('url' in body)) {
      return undefined
    }

    return typeof body.url === 'string' ? body.url.trim() : undefined
  } catch {
    return undefined
  }
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64')
}

export function createPostHandler({ render }: { render: CarmodooRenderer }) {
  return async function POST(request: Request) {
    const url = await readRequestUrl(request)
    let parsedUrl: URL | undefined

    try {
      parsedUrl = url ? new URL(url) : undefined
    } catch {
      parsedUrl = undefined
    }

    if (!url || !parsedUrl || !isCarmodooPrintUrl(parsedUrl)) {
      return createErrorResponse(400, '성능점검기록부 주소를 확인하지 못했어요.')
    }

    try {
      const origin = new URL(request.url).origin
      const images = await render(url, { origin })

      if (images.length === 0 || images.length > CARMODOO_RENDER_MAX_PAGE_COUNT) {
        return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
      }

      return NextResponse.json(
        {
          images: images.map(toBase64),
        },
        {
          headers: {
            'cache-control': 'no-store',
          },
        }
      )
    } catch {
      return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
    }
  }
}

export const POST = createPostHandler({
  render: renderCarmodooNativeImages,
})
```

- [ ] **Step 4: Add a temporary renderer stub so route tests compile**

Create `src/v2/features/file-management/server/carmodoo-native-renderer.ts`:

```ts
export async function renderCarmodooNativeImages(): Promise<Uint8Array[]> {
  throw new Error('Carmodoo native renderer is not implemented yet.')
}
```

This stub is replaced in Task 3.

- [ ] **Step 5: Run the focused route test**

Run:

```bash
bun run test -- --run src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v2/checkpaper/carmodoo-render/route.ts src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts src/v2/features/file-management/server/carmodoo-native-renderer.ts
git commit -m "feat: 카모두 native render route 추가"
```

## Task 3: Implement The Playwright Native Renderer

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `src/v2/features/file-management/server/carmodoo-native-renderer.ts`
- Create: `src/v2/features/file-management/server/__tests__/carmodoo-native-renderer.test.ts`

- [ ] **Step 1: Add Playwright as a runtime dependency if direct import is missing**

Run:

```bash
bun add playwright@^1.59.1
```

Expected: `package.json` includes `playwright` under `dependencies`, and `bun.lock` changes. If Bun reports that the package is already a direct dependency, keep the existing lockfile state and continue.

- [ ] **Step 2: Write renderer orchestration tests with fake browser objects**

Create `src/v2/features/file-management/server/__tests__/carmodoo-native-renderer.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  CARMODOO_RENDER_VIEWPORT,
  renderCarmodooNativeImagesWithBrowser,
} from '../carmodoo-native-renderer'

const carmodooUrl = 'https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658'

describe('renderCarmodooNativeImagesWithBrowser', () => {
  it('loads the proxied Carmodoo page and screenshots each page_wrap as JPG', async () => {
    const firstElement = {
      screenshot: vi.fn(async () => Buffer.from([1, 2, 3])),
    }
    const secondElement = {
      screenshot: vi.fn(async () => Buffer.from([4, 5])),
    }
    const page = {
      $$: vi.fn(async () => [firstElement, secondElement]),
      addStyleTag: vi.fn(),
      close: vi.fn(),
      goto: vi.fn(),
      setViewportSize: vi.fn(),
      waitForLoadState: vi.fn(),
      waitForSelector: vi.fn(),
    }
    const context = {
      close: vi.fn(),
      newPage: vi.fn(async () => page),
    }
    const browser = {
      newContext: vi.fn(async () => context),
    }

    const images = await renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
      origin: 'http://localhost',
      timeoutMs: 15_000,
    })

    expect(images).toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])])
    expect(browser.newContext).toHaveBeenCalledWith({
      deviceScaleFactor: 2,
      locale: 'ko-KR',
      viewport: CARMODOO_RENDER_VIEWPORT,
    })
    expect(page.goto).toHaveBeenCalledWith(
      `http://localhost/api/v2/checkpaper?url=${encodeURIComponent(carmodooUrl)}`,
      {
        timeout: 15_000,
        waitUntil: 'networkidle',
      }
    )
    expect(page.waitForSelector).toHaveBeenCalledWith('.repaircheck_box .page_wrap', {
      state: 'attached',
      timeout: 15_000,
    })
    expect(firstElement.screenshot).toHaveBeenCalledWith({
      quality: 92,
      type: 'jpeg',
    })
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('cleans up the browser context when screenshotting fails', async () => {
    const context = {
      close: vi.fn(),
      newPage: vi.fn(async () => ({
        $$: vi.fn(async () => [
          {
            screenshot: vi.fn(async () => {
              throw new Error('screenshot failed')
            }),
          },
        ]),
        addStyleTag: vi.fn(),
        goto: vi.fn(),
        setViewportSize: vi.fn(),
        waitForLoadState: vi.fn(),
        waitForSelector: vi.fn(),
      })),
    }
    const browser = {
      newContext: vi.fn(async () => context),
    }

    await expect(
      renderCarmodooNativeImagesWithBrowser(browser, carmodooUrl, {
        origin: 'http://localhost',
        timeoutMs: 15_000,
      })
    ).rejects.toThrow('screenshot failed')
    expect(context.close).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run the renderer test and verify it fails against the stub**

Run:

```bash
bun run test -- --run src/v2/features/file-management/server/__tests__/carmodoo-native-renderer.test.ts
```

Expected: FAIL because `renderCarmodooNativeImagesWithBrowser` is not exported.

- [ ] **Step 4: Replace the renderer stub with Playwright implementation**

Modify `src/v2/features/file-management/server/carmodoo-native-renderer.ts`:

```ts
import 'server-only'

import { CARMODOO_RENDER_MAX_PAGE_COUNT } from '@/v2/shared/lib/carmodoo-performance-check'

export const CARMODOO_RENDER_VIEWPORT = {
  height: 1020,
  width: 1440,
}

const DEFAULT_CARMODOO_RENDER_TIMEOUT_MS = 15_000
const CARMODOO_RENDER_SCALE = 2
const CARMODOO_RENDER_JPEG_QUALITY = 92

type ScreenshotElement = {
  screenshot: (options: { quality: number; type: 'jpeg' }) => Promise<Buffer>
}

type RendererPage = {
  $$: (selector: string) => Promise<ScreenshotElement[]>
  addStyleTag: (options: { content: string }) => Promise<unknown>
  goto: (url: string, options: { timeout: number; waitUntil: 'networkidle' }) => Promise<unknown>
  setViewportSize: (viewport: typeof CARMODOO_RENDER_VIEWPORT) => Promise<unknown>
  waitForLoadState: (state: 'networkidle', options: { timeout: number }) => Promise<unknown>
  waitForSelector: (
    selector: string,
    options: { state: 'attached'; timeout: number }
  ) => Promise<unknown>
}

type RendererContext = {
  close: () => Promise<unknown>
  newPage: () => Promise<RendererPage>
}

type RendererBrowser = {
  newContext: (options: {
    deviceScaleFactor: number
    locale: string
    viewport: typeof CARMODOO_RENDER_VIEWPORT
  }) => Promise<RendererContext>
}

function buildProxiedCarmodooUrl(sourceUrl: string, origin: string) {
  return `${origin}/api/v2/checkpaper?url=${encodeURIComponent(sourceUrl)}`
}

function getCarmodooNativeStyle() {
  return `
    body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .repaircheck_box {
      background: #fff !important;
      color: #000 !important;
      font-family: Dotum, 돋움, Arial, sans-serif !important;
      margin: 0 !important;
      width: 1400px !important;
    }
    .repaircheck_box .btn_box {
      display: none !important;
    }
    .repaircheck_box .page_wrap {
      background: #fff !important;
      display: block !important;
      height: 950px !important;
      overflow: hidden !important;
      page-break-after: always !important;
      width: 1400px !important;
    }
  `
}

export async function renderCarmodooNativeImagesWithBrowser(
  browser: RendererBrowser,
  sourceUrl: string,
  {
    origin,
    timeoutMs = DEFAULT_CARMODOO_RENDER_TIMEOUT_MS,
  }: {
    origin: string
    timeoutMs?: number
  }
) {
  const context = await browser.newContext({
    deviceScaleFactor: CARMODOO_RENDER_SCALE,
    locale: 'ko-KR',
    viewport: CARMODOO_RENDER_VIEWPORT,
  })

  try {
    const page = await context.newPage()

    await page.setViewportSize(CARMODOO_RENDER_VIEWPORT)
    await page.goto(buildProxiedCarmodooUrl(sourceUrl, origin), {
      timeout: timeoutMs,
      waitUntil: 'networkidle',
    })
    await page.addStyleTag({ content: getCarmodooNativeStyle() })
    await page.waitForLoadState('networkidle', { timeout: timeoutMs })
    await page.waitForSelector('.repaircheck_box .page_wrap', {
      state: 'attached',
      timeout: timeoutMs,
    })

    const sheets = await page.$$('.repaircheck_box .page_wrap')

    if (sheets.length === 0 || sheets.length > CARMODOO_RENDER_MAX_PAGE_COUNT) {
      throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
    }

    const images: Uint8Array[] = []

    for (const sheet of sheets) {
      const buffer = await sheet.screenshot({
        quality: CARMODOO_RENDER_JPEG_QUALITY,
        type: 'jpeg',
      })
      images.push(new Uint8Array(buffer))
    }

    return images
  } finally {
    await context.close()
  }
}

export async function renderCarmodooNativeImages(sourceUrl: string, options: { origin: string }) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: true,
  })

  try {
    return await renderCarmodooNativeImagesWithBrowser(browser, sourceUrl, options)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 5: Run the renderer test**

Run:

```bash
bun run test -- --run src/v2/features/file-management/server/__tests__/carmodoo-native-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the route test**

Run:

```bash
bun run test -- --run src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock src/v2/features/file-management/server/carmodoo-native-renderer.ts src/v2/features/file-management/server/__tests__/carmodoo-native-renderer.test.ts
git commit -m "feat: 카모두 native renderer 구현"
```

## Task 4: Switch The Client Carmodoo Provider To The Native API

**Files:**

- Modify: `src/v2/features/file-management/performance-check-capture.ts`
- Modify: `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`

- [ ] **Step 1: Replace Carmodoo html2canvas expectations with native API expectations**

In `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`, update the import:

```ts
import {
  capturePerformanceCheckImages,
  type CapturePerformanceCheckImagesOptions,
  type PerformanceCheckPageRenderer,
  type PerformanceCheckNativeRenderer,
} from '../performance-check-capture'
```

Replace the existing `captures Carmodoo print preview sheets with injected print layout` test with:

```ts
it('captures Carmodoo records through the native renderer API', async () => {
  const renderNative = vi.fn<PerformanceCheckNativeRenderer>(async () => [
    new Uint8Array([11, 12]),
    new Uint8Array([13, 14]),
  ])
  const fetchPdf = vi.fn()
  const renderPdfPages = vi.fn()
  const resolvePrintableUrl = vi.fn()

  await expect(
    capturePerformanceCheckImages(carmodooSourceUrl, {
      fetchPdf,
      renderCarmodooNativeImages: renderNative,
      renderPdfPages,
      resolvePrintableUrl,
    })
  ).resolves.toEqual([new Uint8Array([11, 12]), new Uint8Array([13, 14])])

  expect(renderNative).toHaveBeenCalledWith(carmodooSourceUrl, {
    signal: undefined,
    timeoutMs: 15_000,
  })
  expect(resolvePrintableUrl).not.toHaveBeenCalled()
  expect(fetchPdf).not.toHaveBeenCalled()
  expect(renderPdfPages).not.toHaveBeenCalled()
  expect(document.querySelector('iframe')).toBeNull()
})
```

Replace the existing `uses the Carmodoo provider after resolving an autocafe URL` test with:

```ts
it('uses the native Carmodoo provider after resolving an autocafe URL', async () => {
  const resolvePrintableUrl = vi.fn(async () => carmodooSourceUrl)
  const renderNative = vi.fn<PerformanceCheckNativeRenderer>(async () => [new Uint8Array([21])])
  const fetchPdf = vi.fn()

  await expect(
    capturePerformanceCheckImages(autocafeSourceUrl, {
      fetchPdf,
      renderCarmodooNativeImages: renderNative,
      resolvePrintableUrl,
    })
  ).resolves.toEqual([new Uint8Array([21])])

  expect(resolvePrintableUrl).toHaveBeenCalledWith(autocafeSourceUrl, {
    proxyPath: '/api/v2/checkpaper',
    signal: undefined,
  })
  expect(renderNative).toHaveBeenCalledWith(carmodooSourceUrl, {
    signal: undefined,
    timeoutMs: 15_000,
  })
  expect(fetchPdf).not.toHaveBeenCalled()
  expect(document.querySelector('iframe')).toBeNull()
})
```

Replace the existing `rejects and cleans up when the Carmodoo document has no page_wrap elements` test with:

```ts
it('propagates native Carmodoo renderer failures without creating an iframe', async () => {
  const renderNative = vi.fn<PerformanceCheckNativeRenderer>(async () => {
    throw new Error('성능점검기록부 페이지를 찾지 못했습니다.')
  })

  await expect(
    capturePerformanceCheckImages(carmodooSourceUrl, {
      renderCarmodooNativeImages: renderNative,
    })
  ).rejects.toThrow('성능점검기록부 페이지를 찾지 못했습니다.')

  expect(renderNative).toHaveBeenCalledTimes(1)
  expect(document.querySelector('iframe')).toBeNull()
})
```

- [ ] **Step 2: Run the capture test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: FAIL because `PerformanceCheckNativeRenderer` and `renderCarmodooNativeImages` option do not exist.

- [ ] **Step 3: Add the native renderer client option and provider**

In `src/v2/features/file-management/performance-check-capture.ts`, add imports:

```ts
import {
  decodeCarmodooNativeRenderResponse,
  isCarmodooPrintUrl,
} from '@/v2/shared/lib/carmodoo-performance-check'
```

Remove the private `isCarmodooPrintUrl()` function from this file.

Add types:

```ts
export type PerformanceCheckNativeRenderer = (
  sourceUrl: string,
  options: {
    signal?: AbortSignal
    timeoutMs: number
  }
) => Promise<Uint8Array[]>
```

Add `renderCarmodooNativeImages?: PerformanceCheckNativeRenderer` to `CapturePerformanceCheckImagesOptions`.

Add a default renderer:

```ts
const renderCarmodooNativeImagesViaApi: PerformanceCheckNativeRenderer = async (
  sourceUrl,
  { signal }
) => {
  const response = await fetch('/api/v2/checkpaper/carmodoo-render', {
    body: JSON.stringify({ url: sourceUrl }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    signal,
  })

  if (!response.ok) {
    throw new Error('성능점검기록부를 불러오지 못했습니다.')
  }

  return decodeCarmodooNativeRenderResponse(await response.json())
}
```

Add `renderCarmodooNativeImages` to `CaptureContext`:

```ts
type CaptureContext = {
  assetProxyPath: string
  fetchPdf: PerformanceCheckPdfFetcher
  jpegQuality: number
  ownerDocument: Document
  proxyPath: string
  renderCarmodooNativeImages: PerformanceCheckNativeRenderer
  renderPage: PerformanceCheckPageRenderer
  renderPdfPages: PerformanceCheckPdfRenderer
  signal?: AbortSignal
  timeoutMs: number
}
```

Replace `carmodooHtmlProvider` with:

```ts
const carmodooNativeProvider: PerformanceCheckCaptureProvider = {
  id: 'carmodoo-native',
  canHandle: isCarmodooPrintUrl,
  capture(url, context) {
    return context.renderCarmodooNativeImages(url.toString(), {
      signal: context.signal,
      timeoutMs: context.timeoutMs,
    })
  },
}

const performanceCheckProviders = [
  checkpaperPdfProvider,
  carmodooNativeProvider,
] satisfies PerformanceCheckCaptureProvider[]
```

Update the options destructuring:

```ts
renderCarmodooNativeImages = renderCarmodooNativeImagesViaApi,
```

Update `captureContext`:

```ts
const captureContext: CaptureContext = {
  assetProxyPath,
  fetchPdf,
  jpegQuality,
  ownerDocument,
  proxyPath,
  renderCarmodooNativeImages,
  renderPage,
  renderPdfPages,
  signal,
  timeoutMs,
}
```

- [ ] **Step 4: Run the capture test**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/features/file-management/performance-check-capture.ts src/v2/features/file-management/__tests__/performance-check-capture.test.ts
git commit -m "fix: 카모두 native renderer 저장 경로 적용"
```

## Task 5: Remove The Obsolete Carmodoo html2canvas Composition Code

**Files:**

- Modify: `src/v2/features/file-management/performance-check-capture.ts`
- Modify: `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`

- [ ] **Step 1: Delete unused Carmodoo HTML composition constants and helpers**

In `src/v2/features/file-management/performance-check-capture.ts`, remove these now-unused items:

```ts
const CARMODOO_CHECKBOX_ICON_URL = 'https://ck.carmodoo.com/images/input_checkbox.png'
const CARMODOO_PRINT_SHEET_WIDTH = 1440
const CARMODOO_PRINT_SHEET_HEIGHT = 1020
const CARMODOO_PRINT_CONTENT_WIDTH = 1400
const CARMODOO_PRINT_CONTENT_HEIGHT = 950
const CARMODOO_PRINT_CONTENT_LEFT = 45
const CARMODOO_PRINT_CONTENT_TOP = 66
const CARMODOO_PRINT_CONTENT_SCALE = 0.964
const CARMODOO_PRINT_HEADER_TOP = 26
const CARMODOO_PRINT_FOOTER_TOP = 984
const CARMODOO_PRINT_BROWSER_TEXT_LEFT = 45
const CARMODOO_PRINT_BROWSER_TEXT_RIGHT = 45
const CARMODOO_PRINT_BROWSER_TEXT_SIZE = 12
```

Also remove these helpers if TypeScript reports they are unused:

```ts
restoreStyleProperty
drawCarmodooPrintBrowserText
renderCarmodooPrintSheet
captureCarmodooHtmlImages
replaceCarmodooCheckboxes
formatCarmodooPrintDate
createCarmodooPrintSheets
injectCarmodooPrintLayout
prepareCarmodooFrameDocument
escapeCssString
```

Keep generic HTML fallback helpers such as `captureHtmlPageImages()` because `preferPrintablePdf: false` tests still cover them.

- [ ] **Step 2: Remove obsolete test imports and helpers**

In `src/v2/features/file-management/__tests__/performance-check-capture.test.ts`, remove `proxiedCarmodooSourceUrl` and any Carmodoo-specific canvas/context setup that is no longer referenced.

- [ ] **Step 3: Run lint on the capture module**

Run:

```bash
bun run lint -- src/v2/features/file-management/performance-check-capture.ts src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: PASS with no unused variable errors.

- [ ] **Step 4: Run the capture test**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/features/file-management/performance-check-capture.ts src/v2/features/file-management/__tests__/performance-check-capture.test.ts
git commit -m "refactor: 카모두 html2canvas 합성 제거"
```

## Task 6: Verify Save Layer Compatibility

**Files:**

- Test: `src/v2/features/file-management/__tests__/file-system.test.ts`
- Test: `src/v2/features/file-management/__tests__/zip-fallback.test.ts`

- [ ] **Step 1: Run existing save layer tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts
```

Expected: PASS. These tests already verify that `Uint8Array[]` from `capturePerformanceCheckImages()` is saved as:

```text
성능점검기록부/{차량번호}_성능점검기록부_1.jpg
성능점검기록부/{차량번호}_성능점검기록부_2.jpg
```

- [ ] **Step 2: If tests fail, fix only the contract mismatch**

Do not change saved folder names, file names, or user-facing labels. The correct contract is still:

```ts
type CapturePerformanceCheckImages = (performanceCheckUrl?: string | null) => Promise<Uint8Array[]>
```

- [ ] **Step 3: Commit only if code changed**

If Step 2 required edits:

```bash
git add src/v2/features/file-management/file-system.ts src/v2/features/file-management/zip-fallback.ts src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts
git commit -m "fix: 성능점검 저장 계약 유지"
```

If no edits were needed, skip this commit.

## Task 7: Update Documentation

**Files:**

- Modify: `docs/architecture.md`

- [ ] **Step 1: Update CheckPaper Integration wording**

In `docs/architecture.md`, replace the Carmodoo paragraph under `## CheckPaper Integration` with:

```md
`POST /api/v2/parse-truck` returns `performanceCheckUrl` when the listing page
contains a `성능점검보기` link. During save, the client asks the same-origin
CheckPaper routes to resolve the record and then chooses the supported renderer:
existing CheckPaper `record.do` PDF pages are rendered as JPGs in the browser,
and Carmodoo `carmodooPrint.do?checkNum=7126000658` HTML records are rendered through a
same-origin native browser renderer API so the saved JPGs match the browser
layout.

- `GET /api/v2/checkpaper` fetches supported CheckPaper or intermediate pages,
  follows redirects, and rewrites assets to same-origin URLs.
- `GET /api/v2/checkpaper/asset` proxies supported CSS, image, script, and
  printable record assets.
- `POST /api/v2/checkpaper/carmodoo-render` accepts only Carmodoo print URLs and
  returns the rendered JPG pages for the save flow.

The app does not upload these records anywhere; it only saves them into the
user's selected folder or ZIP file. Performance-check saving remains non-fatal.
```

- [ ] **Step 2: Run format check for docs**

Run:

```bash
bun run format:check
```

Expected: PASS. If it fails because of Markdown formatting, run:

```bash
bun run format
```

Then inspect the diff and keep only intended formatting changes.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: 카모두 native renderer 구조 문서화"
```

## Task 8: Full Verification And Visual Smoke Test

**Files:**

- No required source edits.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/carmodoo-performance-check.test.ts src/app/api/v2/checkpaper/carmodoo-render/__tests__/route.test.ts src/v2/features/file-management/server/__tests__/carmodoo-native-renderer.test.ts src/v2/features/file-management/__tests__/performance-check-capture.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the standard verification suite**

Run:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
bun run build
```

Expected: PASS. If the sandbox blocks process or port binding, rerun with escalated permissions and record the reason in the final report.

- [ ] **Step 4: Start the dev server for visual verification**

Run:

```bash
bun run dev -- --port 3011
```

Expected: the app starts on `http://localhost:3011`.

- [ ] **Step 5: Exercise the renderer route with the known failing URL**

Run this request from another terminal:

```bash
curl -sS \
  -X POST \
  -H 'content-type: application/json' \
  --data '{"url":"https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658"}' \
  http://localhost:3011/api/v2/checkpaper/carmodoo-render \
  > /private/tmp/carmodoo-native-render-response.json
```

Expected: JSON with exactly two base64 images:

```json
{
  "images": ["BASE64_JPG_PAGE_1", "BASE64_JPG_PAGE_2"]
}
```

- [ ] **Step 6: Decode the images for visual inspection**

Run:

```bash
bun -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('/private/tmp/carmodoo-native-render-response.json','utf8')); data.images.forEach((image,index)=>fs.writeFileSync('/private/tmp/carmodoo-native-render-'+(index+1)+'.jpg', Buffer.from(image,'base64')));"
```

Expected files:

```text
/private/tmp/carmodoo-native-render-1.jpg
/private/tmp/carmodoo-native-render-2.jpg
```

- [ ] **Step 7: Compare against the previous evidence**

Open:

```text
/private/tmp/carmodoo-native-render-1.jpg
/private/tmp/carmodoo-native-render-2.jpg
/private/tmp/carmodoo-same-dom-native-pagewrap.png
/private/tmp/carmodoo-same-dom-html2canvas-pagewrap.jpg
```

Expected: new JPGs match the Chrome native rendering and do not show the `html2canvas` text/checkbox drift.

- [ ] **Step 8: Stop the dev server**

Stop the `bun run dev -- --port 3011` session with Ctrl-C.

- [ ] **Step 9: Push the branch and update the PR**

Because this worktree is on `main` and already ahead of `origin/main`, do not switch branches. Push the existing commits to the PR branch only if the current workflow already maps this local `main` to PR #20. Otherwise confirm the exact push target before pushing.

Expected PR: `https://github.com/jaem1n207/truck-harvester/pull/20`.
