# V2 Root Cutover And Legacy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rebuilt V2 truck harvester load from `/` by default, keep `/v2` as a compatibility redirect, and remove legacy runtime code, tests, assets, and dependencies that are no longer used.

**Architecture:** Promote the V2 route component into the root app route while keeping `src/v2/*` as the internal feature namespace to avoid a risky full-folder rename. Move the V2 theme to root layout, simplify root providers to remove legacy ThemeProvider, analytics, Sentry, watermark, and decorative signature code, then delete legacy `src/shared/*`, `src/widgets/*`, old API routes, old tests, and unused V2 prototype widgets.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Motion, Vitest, Playwright, Bun.

---

## Scope And Boundaries

- Root `/` becomes the primary user-facing page.
- `/v2` remains reachable only as a redirect to `/` so old shared links do not break.
- `src/v2/*` stays as the internal implementation namespace for now. Do not rename it in this cleanup; that would create large import churn without user value.
- Keep `/api/v2/parse-truck` for the current client API. Delete legacy `/api/parse-truck` after confirming root no longer imports legacy code.
- Remove Sentry entirely from this app unless a current V2 file imports it. V2 policy is still "No Sentry".
- Remove watermark code and watermark image assets. V2 saves original fetched image blobs directly.
- Remove only dependencies proven unused after code deletion by `rg`.

## File Responsibility Map

- `src/app/page.tsx`: root route entrypoint for the promoted V2 app.
- `src/app/truck-harvester-app.tsx`: promoted V2 client app, renamed from `TruckHarvesterV2App` to `TruckHarvesterApp`.
- `src/app/v2/page.tsx`: compatibility redirect from `/v2` to `/`.
- `src/app/theme.css`: root-level V2 theme tokens moved from `src/app/v2/theme.css`.
- `src/app/layout.tsx`: root metadata and V2 theme wrapper; no legacy ThemeProvider, Signature, or Vercel Analytics.
- `src/app/global-error.tsx`: plain Next global error page with no Sentry capture.
- `src/app/not-found.tsx`: 404 page using V2 button primitive, no legacy shared UI import.
- `src/app/__tests__/page.test.tsx`: root route tests moved from `src/app/v2/__tests__/page.test.tsx`.
- `src/app/__tests__/truck-harvester-app.test.tsx`: app behavior tests moved from `src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx`.
- `src/app/v2/__tests__/page.test.tsx`: redirect-only test for `/v2`.
- `playwright.config.ts` and `e2e/*.spec.ts`: use `/` as the base route instead of `/v2`.
- `vitest.config.ts`: coverage includes promoted root app tests and V2 internals; remove legacy setup file path.
- `src/v2/widgets/url-input/index.ts`: export only currently used V2 URL input API.
- `src/v2/widgets/processing-status/index.ts`: export only currently used prepared-listing status panel.
- `src/v2/shared/model/index.ts`: export only currently used onboarding store.
- `src/v2/shared/lib/copy.ts`: remove copy groups that belonged only to deleted prototype widgets.
- `docs/architecture.md`, `docs/runbooks/*.md`, `src/v2/*/AGENTS.md`, `src/v2/testing/__tests__/*.test.ts`: update knowledge-base expectations from "parallel `/v2` route" to "root route powered by `src/v2` internals".

## Task 1: Promote V2 App To Root Route

**Files:**

- Move: `src/app/v2/truck-harvester-v2-app.tsx` -> `src/app/truck-harvester-app.tsx`
- Move: `src/app/v2/theme.css` -> `src/app/theme.css`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/v2/page.tsx`
- Delete: `src/app/v2/layout.tsx`
- Move test: `src/app/v2/__tests__/page.test.tsx` -> `src/app/__tests__/page.test.tsx`
- Move test: `src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx` -> `src/app/__tests__/truck-harvester-app.test.tsx`
- Create/modify test: `src/app/v2/__tests__/page.test.tsx`

- [ ] **Step 1: Write the failing root route test**

Move the existing page test first:

```bash
mkdir -p src/app/__tests__
git mv src/app/v2/__tests__/page.test.tsx src/app/__tests__/page.test.tsx
```

In `src/app/__tests__/page.test.tsx`, change the test URL and imports from the V2 directory to the root directory:

```ts
// Replace this JSDOM URL:
url: 'http://localhost/v2',

// With:
url: 'http://localhost/',

// Replace imports inside tests:
const V2Page = (await import('../page')).default

// With:
const HomePage = (await import('../page')).default

// Replace render usage:
const html = renderToStaticMarkup(<V2Page />)

// With:
const html = renderToStaticMarkup(<HomePage />)
```

Also rename the suite:

```ts
describe('HomePage', () => {
  it('renders the operational V2 flow at the root route', async () => {
    const HomePage = (await import('../page')).default
    const html = renderToStaticMarkup(<HomePage />)

    expect(html).toContain('data-tour="v2-page"')
    expect(html).toContain('매물 주소 넣기')
    expect(html).toContain('저장 진행 상황')
    expect(html).toContain('도움말')
    expect(html).not.toContain('오늘 작업')
    expect(html).not.toContain('가져올 매물')
  })
})
```

- [ ] **Step 2: Write the failing `/v2` redirect test**

Create a new `src/app/v2/__tests__/page.test.tsx`:

```ts
import { describe, expect, it, vi } from 'vitest'

const redirectMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

describe('V2 compatibility route', () => {
  it('redirects old /v2 links to the root app', async () => {
    const V2Page = (await import('../page')).default

    V2Page()

    expect(redirectMock).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 3: Run the route tests and verify they fail**

Run:

```bash
bun run test -- --run src/app/__tests__/page.test.tsx src/app/v2/__tests__/page.test.tsx
```

Expected: FAIL because root still renders legacy `TruckHarvesterApp` and `/v2/page.tsx` still renders `TruckHarvesterV2App` instead of redirecting.

- [ ] **Step 4: Move the V2 app and theme files**

Run:

```bash
git mv src/app/v2/truck-harvester-v2-app.tsx src/app/truck-harvester-app.tsx
git mv src/app/v2/theme.css src/app/theme.css
git mv src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx src/app/__tests__/truck-harvester-app.test.tsx
```

In `src/app/truck-harvester-app.tsx`, rename the exported component:

```ts
// Before
export function TruckHarvesterV2App() {

// After
export function TruckHarvesterApp() {
```

In `src/app/__tests__/truck-harvester-app.test.tsx`, update the import path and component name:

```ts
const { TruckHarvesterApp } = await import('../truck-harvester-app')

root?.render(<TruckHarvesterApp />)
```

Replace all remaining `TruckHarvesterV2App` names in that moved test with `TruckHarvesterApp`.

- [ ] **Step 5: Update root page**

Set `src/app/page.tsx` to:

```tsx
import { TruckHarvesterApp } from './truck-harvester-app'

export default function HomePage() {
  return <TruckHarvesterApp />
}
```

- [ ] **Step 6: Replace `/v2` page with a compatibility redirect**

Set `src/app/v2/page.tsx` to:

```ts
import { redirect } from 'next/navigation'

export default function V2Page() {
  redirect('/')
}
```

Delete the old nested V2 layout:

```bash
git rm src/app/v2/layout.tsx
```

- [ ] **Step 7: Simplify root layout and apply the V2 theme globally**

Set `src/app/layout.tsx` to:

```tsx
import type { Metadata } from 'next'

import './globals.css'
import './theme.css'

export const metadata: Metadata = {
  title: {
    default: '트럭 매물 수집기',
    template: '%s | 트럭 매물 수집기',
  },
  description:
    '중고 트럭 매물 주소를 빠르게 확인하고 차량별 이미지 폴더로 정리하는 작업 화면입니다.',
  keywords: [
    '트럭',
    '중고트럭',
    '매물수집',
    '데이터수집',
    '매물정보',
    '트럭매매',
    '상용차',
    '화물차',
  ],
  authors: [{ name: 'Truck Harvester Team' }],
  creator: 'Truck Harvester Team',
  publisher: 'Truck Harvester',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://truck-harvester.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    title: '트럭 매물 수집기',
    description: '중고 트럭 매물 주소를 확인하고 차량별 이미지 폴더로 정리합니다.',
    siteName: '트럭 매물 수집기',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '트럭 매물 수집기',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '트럭 매물 수집기',
    description: '중고 트럭 매물 주소를 확인하고 차량별 이미지 폴더로 정리합니다.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'productivity',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <div className="v2-theme min-h-dvh">{children}</div>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: Run route tests and verify they pass**

Run:

```bash
bun run test -- --run src/app/__tests__/page.test.tsx src/app/__tests__/truck-harvester-app.test.tsx src/app/v2/__tests__/page.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/app/theme.css src/app/truck-harvester-app.tsx src/app/__tests__/page.test.tsx src/app/__tests__/truck-harvester-app.test.tsx src/app/v2/page.tsx src/app/v2/__tests__/page.test.tsx
git add -u src/app/v2
git commit -m "feat: 기본 경로를 새 작업 화면으로 전환"
```

## Task 2: Remove Legacy Runtime, Sentry, And Watermark Code

**Files:**

- Modify: `src/app/global-error.tsx`
- Modify: `src/app/not-found.tsx`
- Delete: `src/app/api/parse-truck/route.ts`
- Delete: `src/app/api/parse-truck/__tests__/route.test.ts`
- Delete: `src/app/api/network-test/route.ts`
- Delete: `src/app/api/sentry-error-handler.ts`
- Delete: `src/app/api/sentry-example-api/route.ts`
- Delete: `src/app/sentry-example-page/page.tsx`
- Delete: `src/app/v2/AGENTS.md`
- Delete: `src/instrumentation.ts`
- Delete: `src/instrumentation-client.ts`
- Delete: `sentry.server.config.ts`
- Delete: `sentry.edge.config.ts`
- Delete: `src/shared/**`
- Delete: `src/widgets/**`
- Delete: `public/watermark-1.png`
- Delete: `public/watermark-2.png`
- Delete: `public/watermark-3.png`
- Delete: `public/watermark-4.png`
- Delete: `public/watermark-5.png`

- [ ] **Step 1: Write a cleanup guard test**

Create `src/v2/testing/__tests__/legacy-cleanup.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

const deletedPaths = [
  'src/app/api/parse-truck/route.ts',
  'src/app/api/network-test/route.ts',
  'src/app/api/sentry-error-handler.ts',
  'src/app/api/sentry-example-api/route.ts',
  'src/app/sentry-example-page/page.tsx',
  'src/instrumentation.ts',
  'src/instrumentation-client.ts',
  'sentry.server.config.ts',
  'sentry.edge.config.ts',
  'src/shared',
  'src/widgets',
  'public/watermark-1.png',
  'public/watermark-2.png',
  'public/watermark-3.png',
  'public/watermark-4.png',
  'public/watermark-5.png',
]

const sourceFiles = [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/truck-harvester-app.tsx',
  'src/app/global-error.tsx',
  'src/app/not-found.tsx',
]

describe('legacy cleanup boundary', () => {
  it('removes legacy runtime files and watermark assets', () => {
    for (const path of deletedPaths) {
      expect(existsSync(join(root, path)), path).toBe(false)
    }
  })

  it('keeps root runtime free of legacy imports and Sentry', () => {
    for (const path of sourceFiles) {
      const source = readFileSync(join(root, path), 'utf8')

      expect(source).not.toContain('@/shared')
      expect(source).not.toContain('@/widgets')
      expect(source).not.toContain('@sentry/nextjs')
      expect(source).not.toMatch(/Sentry|sentry/)
      expect(source).not.toMatch(/watermark|Watermark/)
    }
  })
})
```

- [ ] **Step 2: Run cleanup guard and verify it fails**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/legacy-cleanup.test.ts
```

Expected: FAIL because legacy files still exist.

- [ ] **Step 3: Remove Sentry from global error**

Set `src/app/global-error.tsx` to:

```tsx
'use client'

import NextError from 'next/error'

export default function GlobalError() {
  return (
    <html lang="ko">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Update not-found to use V2 UI**

Set `src/app/not-found.tsx` to:

```tsx
import Link from 'next/link'

import { ArrowLeft, Truck } from 'lucide-react'

import { Button } from '@/v2/shared/ui/button'

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-dvh items-center justify-center px-6">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-muted rounded-xl p-4">
            <Truck aria-hidden="true" className="text-muted-foreground size-12" />
          </div>
        </div>
        <h1 className="mb-2 text-4xl font-bold">404</h1>
        <h2 className="mb-4 text-xl font-semibold">페이지를 찾을 수 없습니다</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다. 트럭 매물 수집기 메인 페이지로
          돌아가세요.
        </p>
        <Button asChild>
          <Link href="/">
            <ArrowLeft aria-hidden="true" className="size-4" />
            메인 페이지로 돌아가기
          </Link>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Delete legacy runtime and assets**

Run:

```bash
git rm -r src/shared src/widgets
git rm -r src/app/api/parse-truck
git rm src/app/api/network-test/route.ts
git rm src/app/api/sentry-error-handler.ts
git rm src/app/api/sentry-example-api/route.ts
git rm -r src/app/sentry-example-page
git rm src/app/v2/AGENTS.md
git rm src/instrumentation.ts src/instrumentation-client.ts
git rm sentry.server.config.ts sentry.edge.config.ts
git rm public/watermark-1.png public/watermark-2.png public/watermark-3.png public/watermark-4.png public/watermark-5.png
```

- [ ] **Step 6: Verify no runtime source imports legacy modules**

Run:

```bash
rg -n "@/shared|@/widgets|@sentry/nextjs|Sentry|sentry|watermark|Watermark" src/app src/v2
```

Expected: no output except allowed Korean documentation test strings if a test intentionally checks absence. If any runtime source appears, update it to V2 imports or delete the unused file.

- [ ] **Step 7: Run cleanup guard and route tests**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/legacy-cleanup.test.ts src/app/__tests__/page.test.tsx src/app/v2/__tests__/page.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/global-error.tsx src/app/not-found.tsx src/v2/testing/__tests__/legacy-cleanup.test.ts
git add -u src app public sentry.server.config.ts sentry.edge.config.ts
git commit -m "refactor: legacy 런타임 코드 제거"
```

## Task 3: Remove Unused V2 Prototype Widgets And State

**Files:**

- Modify: `src/v2/widgets/url-input/index.ts`
- Delete: `src/v2/widgets/url-input/ui/url-input-form.tsx`
- Delete: `src/v2/widgets/url-input/ui/url-list.tsx`
- Delete: `src/v2/widgets/url-input/ui/__tests__/url-input-form.test.tsx`
- Delete: `src/v2/widgets/url-input/ui/__tests__/url-list.test.tsx`
- Modify: `src/v2/widgets/processing-status/index.ts`
- Delete: `src/v2/widgets/processing-status/ui/attention-panel.tsx`
- Delete: `src/v2/widgets/processing-status/ui/processing-status.tsx`
- Delete: `src/v2/widgets/processing-status/ui/__tests__/attention-panel.test.tsx`
- Delete: `src/v2/widgets/processing-status/ui/__tests__/processing-status.test.tsx`
- Modify: `src/v2/shared/model/index.ts`
- Delete: `src/v2/shared/model/selectors.ts`
- Delete: `src/v2/shared/model/truck-batch-store.ts`
- Delete: `src/v2/shared/model/__tests__/selectors.test.ts`
- Delete: `src/v2/shared/model/__tests__/truck-batch-store.test.ts`
- Modify: `src/v2/shared/lib/copy.ts`

- [ ] **Step 1: Write a public API guard test**

Create `src/v2/testing/__tests__/public-api-cleanup.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('V2 public API cleanup', () => {
  it('exports only active URL input components', () => {
    const source = read('src/v2/widgets/url-input/index.ts')

    expect(source).toContain("export * from './model'")
    expect(source).toContain("export * from './ui/listing-chip-input'")
    expect(source).not.toContain('url-input-form')
    expect(source).not.toContain('url-list')
  })

  it('exports only the active prepared listing status panel', () => {
    const source = read('src/v2/widgets/processing-status/index.ts')

    expect(source).toBe("export * from './ui/prepared-listing-status'\n")
  })

  it('exports only active shared model state', () => {
    const source = read('src/v2/shared/model/index.ts')

    expect(source).toBe("export * from './onboarding-store'\n")
  })
})
```

- [ ] **Step 2: Run the public API guard and verify it fails**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/public-api-cleanup.test.ts
```

Expected: FAIL because stale exports still exist.

- [ ] **Step 3: Update V2 public exports**

Set `src/v2/widgets/url-input/index.ts` to:

```ts
export * from './model'
export * from './ui/listing-chip-input'
```

Set `src/v2/widgets/processing-status/index.ts` to:

```ts
export * from './ui/prepared-listing-status'
```

Set `src/v2/shared/model/index.ts` to:

```ts
export * from './onboarding-store'
```

- [ ] **Step 4: Remove deleted prototype files**

Run:

```bash
git rm src/v2/widgets/url-input/ui/url-input-form.tsx
git rm src/v2/widgets/url-input/ui/url-list.tsx
git rm src/v2/widgets/url-input/ui/__tests__/url-input-form.test.tsx
git rm src/v2/widgets/url-input/ui/__tests__/url-list.test.tsx
git rm src/v2/widgets/processing-status/ui/attention-panel.tsx
git rm src/v2/widgets/processing-status/ui/processing-status.tsx
git rm src/v2/widgets/processing-status/ui/__tests__/attention-panel.test.tsx
git rm src/v2/widgets/processing-status/ui/__tests__/processing-status.test.tsx
git rm src/v2/shared/model/selectors.ts
git rm src/v2/shared/model/truck-batch-store.ts
git rm src/v2/shared/model/__tests__/selectors.test.ts
git rm src/v2/shared/model/__tests__/truck-batch-store.test.ts
```

- [ ] **Step 5: Remove stale copy groups**

In `src/v2/shared/lib/copy.ts`, delete the `urlList`, `processingStatus`, and `attentionPanel` objects. Keep the file as:

```ts
export const v2Copy = {
  urlInput: {
    title: '매물 주소 넣기',
    description: '복사한 내용을 그대로 붙여넣으세요. 매물 주소만 자동으로 찾습니다.',
    label: '매물 주소',
    placeholder: '복사한 내용을 여기에 붙여넣으세요',
    submit: '매물 확인 시작',
    errors: {
      empty: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
      invalid: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    },
  },
  directorySelector: {
    title: '저장 폴더 선택',
    explainer: '사진과 차량 정보가 차량번호별 폴더로 정리됩니다. 저장할 위치를 먼저 골라주세요.',
    choose: '저장 폴더 고르기',
    unsupportedTitle: '압축 파일로 저장됩니다',
    unsupportedDescription:
      '이 브라우저에서는 폴더를 직접 고를 수 없어, 모든 파일을 압축 파일로 내려받습니다.',
  },
} as const
```

- [ ] **Step 6: Verify no deleted V2 symbols remain**

Run:

```bash
rg -n "UrlInputForm|UrlList|AttentionPanel|TruckBatchItem|TruckBatchState|selectInProgress|selectDone|v2Copy\\.processingStatus|v2Copy\\.attentionPanel|v2Copy\\.urlList" src/v2 src/app
```

Expected: no output.

- [ ] **Step 7: Run active V2 widget/model tests**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/public-api-cleanup.test.ts src/v2/widgets/url-input/ui/__tests__/listing-chip-input.test.tsx src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx src/v2/shared/model/__tests__/onboarding-store.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/v2/widgets/url-input/index.ts src/v2/widgets/processing-status/index.ts src/v2/shared/model/index.ts src/v2/shared/lib/copy.ts src/v2/testing/__tests__/public-api-cleanup.test.ts
git add -u src/v2/widgets src/v2/shared/model
git commit -m "refactor: 사용하지 않는 v2 프로토타입 제거"
```

## Task 4: Remove Unused Dependencies And Update Test Configs

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `vitest.config.ts`
- Modify: `playwright.config.ts`
- Modify: `e2e/a11y.spec.ts`
- Modify: `e2e/chip-input-workbench.spec.ts`
- Modify: `e2e/happy-path-batch.spec.ts`
- Modify: `e2e/start-without-save-folder.spec.ts`
- Delete: `src/shared/lib/test-setup.ts` already removed with `src/shared`

- [ ] **Step 1: Write config expectations in an existing scaffold test**

Update `src/v2/testing/__tests__/testing-scaffold.test.ts` so it expects root e2e URLs and no legacy test setup:

```ts
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('testing scaffold', () => {
  it('keeps Vitest coverage focused on root app and v2 internals', () => {
    const config = readFileSync('vitest.config.ts', 'utf8')

    expect(config).toContain("include: ['src/app/**/*.{ts,tsx}', 'src/v2/**/*.{ts,tsx}']")
    expect(config).not.toContain('src/shared/lib/test-setup')
  })

  it('runs Playwright against the root route', () => {
    const config = readFileSync('playwright.config.ts', 'utf8')

    expect(config).toContain("baseURL: 'http://localhost:3000'")
    expect(config).toContain("url: 'http://localhost:3000'")
    expect(config).not.toContain('localhost:3000/v2')
  })
})
```

- [ ] **Step 2: Run scaffold test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/testing-scaffold.test.ts
```

Expected: FAIL because configs still reference `/v2` or legacy setup.

- [ ] **Step 3: Remove unused dependencies**

Run:

```bash
bun remove @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-progress @radix-ui/react-select @radix-ui/react-switch @radix-ui/react-toast @sentry/nextjs @tanstack/react-form @types/canvas-confetti @vercel/analytics canvas-confetti date-fns next-themes
```

After removal, verify these packages are gone:

```bash
rg -n "@radix-ui/react-alert-dialog|@radix-ui/react-dialog|@radix-ui/react-progress|@radix-ui/react-select|@radix-ui/react-switch|@radix-ui/react-toast|@sentry/nextjs|@tanstack/react-form|@types/canvas-confetti|@vercel/analytics|canvas-confetti|date-fns|next-themes" package.json bun.lock src
```

Expected: no output.

- [ ] **Step 4: Update Vitest config**

Set the `test` block in `vitest.config.ts` to:

```ts
test: {
  environment: 'jsdom',
  exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  globals: true,
  coverage: {
    provider: 'v8',
    include: ['src/app/**/*.{ts,tsx}', 'src/v2/**/*.{ts,tsx}'],
    exclude: [
      'src/app/**/__tests__/**',
      'src/app/**/*.test.{ts,tsx}',
      'src/v2/**/__tests__/**',
      'src/v2/**/*.test.{ts,tsx}',
      'src/v2/**/AGENTS.md',
    ],
    thresholds: {
      lines: 80,
    },
  },
},
```

Keep the existing `plugins`, `resolve.alias`, and `css` config.

- [ ] **Step 5: Update Playwright config**

Set `playwright.config.ts` to:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 6: Update e2e navigation**

In each e2e file, replace:

```ts
await page.goto('/v2')
```

With:

```ts
await page.goto('/')
```

Apply to:

```text
e2e/a11y.spec.ts
e2e/chip-input-workbench.spec.ts
e2e/happy-path-batch.spec.ts
e2e/start-without-save-folder.spec.ts
```

Keep route mocks for `**/api/v2/parse-truck`; that API remains current.

- [ ] **Step 7: Run config and representative route tests**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/testing-scaffold.test.ts src/app/__tests__/page.test.tsx src/app/__tests__/truck-harvester-app.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock vitest.config.ts playwright.config.ts e2e/a11y.spec.ts e2e/chip-input-workbench.spec.ts e2e/happy-path-batch.spec.ts e2e/start-without-save-folder.spec.ts src/v2/testing/__tests__/testing-scaffold.test.ts
git commit -m "chore: cutover 후 미사용 의존성 정리"
```

## Task 5: Update Docs And Knowledge Base For Root Cutover

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/runbooks/add-e2e-test.md`
- Modify: `docs/runbooks/debug-failed-scrape.md`
- Modify: `docs/runbooks/add-design-token.md`
- Modify: `src/v2/AGENTS.md`
- Modify: `src/v2/design-system/README.md`
- Modify: `src/v2/testing/__tests__/knowledge-base.test.ts`
- Modify: `CLAUDE.md` only if it still references `src/shared/lib/test-setup.ts`, legacy route ownership, Sentry, or watermark as active runtime.

- [ ] **Step 1: Update knowledge-base tests first**

In `src/v2/testing/__tests__/knowledge-base.test.ts`, update expectations:

```ts
expect(architecture).toContain('The rebuilt app is served from `/`')
expect(architecture).toContain('/api/v2/parse-truck')
expect(architecture).not.toContain('parallel rebuild')
expect(architecture).not.toContain('must not break the legacy `/` route')
```

If the test currently lists `src/app/v2/AGENTS.md`, remove it from the expected knowledge-base path list because that file is deleted.

- [ ] **Step 2: Run knowledge-base test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/knowledge-base.test.ts
```

Expected: FAIL because docs still describe `/v2` as a parallel route.

- [ ] **Step 3: Update architecture doc**

In `docs/architecture.md`, replace the opening with:

```md
# Truck Harvester Architecture

The rebuilt app is served from `/`. The implementation still lives under
`src/v2/*` as an internal namespace, but users no longer need to open a
separate `/v2` route. The old `/v2` URL redirects to `/` for compatibility.

The runtime does not use Sentry or watermarking. Images are fetched and saved
directly, and the current parse API is `POST /api/v2/parse-truck`.
```

Replace any sequence diagram participant named `/v2 page` with `/ page`.

- [ ] **Step 4: Update runbooks**

In `docs/runbooks/add-e2e-test.md`, replace:

```md
2. Navigate explicitly to `/v2`.
```

With:

```md
2. Navigate to `/`. Keep `/api/v2/parse-truck` mocks when testing parsing.
```

In `docs/runbooks/debug-failed-scrape.md`, replace:

```md
Use this when `/v2` cannot parse a truck listing or returns incomplete
```

With:

```md
Use this when the root app cannot parse a truck listing or returns incomplete
```

In `docs/runbooks/add-design-token.md`, replace references to `src/app/v2/theme.css` with `src/app/theme.css`.

- [ ] **Step 5: Update V2 namespace docs**

In `src/v2/AGENTS.md`, replace the introduction with:

```md
# src/v2 AGENTS.md

`src/v2` contains the current truck harvester implementation used by the root
`/` route. The folder name remains `v2` to preserve the rebuild namespace and
avoid unnecessary import churn after cutover.

## Hard Rules

- Do not import legacy `src/shared/*` or `src/widgets/*`; those folders were removed after cutover.
- Do not add Sentry.
- Do not add watermarking.
- Keep user-facing copy Korean-only and understandable for non-technical staff.
```

In `src/v2/design-system/README.md`, replace `src/app/v2/theme.css` with `src/app/theme.css`, and replace "`/v2` color" wording with "root app color" where the meaning is user-facing.

- [ ] **Step 6: Update CLAUDE.md if stale**

Run:

```bash
rg -n "src/shared/lib/test-setup|legacy `/`|/v2 route|Sentry|watermark" CLAUDE.md
```

If it returns active-runtime guidance, update those sections to say:

```md
- **Setup**: Vitest uses jsdom directly; there is no legacy shared test setup file.
- The root `/` route serves the rebuilt truck harvester UI.
- Sentry and watermarking are not part of the current runtime.
```

- [ ] **Step 7: Run docs tests**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/knowledge-base.test.ts src/v2/testing/__tests__/testing-scaffold.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture.md docs/runbooks/add-e2e-test.md docs/runbooks/debug-failed-scrape.md docs/runbooks/add-design-token.md src/v2/AGENTS.md src/v2/design-system/README.md src/v2/testing/__tests__/knowledge-base.test.ts CLAUDE.md
git commit -m "docs: 루트 전환 후 지식 베이스 갱신"
```

## Task 6: Final Verification And Cutover QA

**Files:**

- No planned source edits. Fix only if verification reveals a real regression.

- [ ] **Step 1: Run repository-wide static checks**

Run:

```bash
bun run typecheck
bun run lint
bun run format:check
```

Expected: all PASS.

- [ ] **Step 2: Run unit tests**

Run:

```bash
bun run test -- --run
```

Expected: all PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
bun run build
```

Expected: build succeeds and there is no Sentry instrumentation warning.

- [ ] **Step 4: Run route/dependency cleanup scans**

Run:

```bash
rg -n "@/shared|@/widgets|@sentry/nextjs|Sentry|sentry|watermark|Watermark|canvas-confetti|next-themes|@vercel/analytics|date-fns|@tanstack/react-form|src/app/v2/theme.css|localhost:3000/v2|page.goto\\('/v2'\\)" src e2e docs package.json bun.lock playwright.config.ts vitest.config.ts
```

Expected: no output except historical docs under `docs/superpowers/specs/*` and `docs/superpowers/plans/*`. If historical docs appear, do not rewrite old plan/spec history unless a current test requires it.

- [ ] **Step 5: Run Playwright smoke tests**

Run:

```bash
bun run test:e2e -- --project=chromium
```

Expected: all PASS. Each test should navigate to `/`, while network mocks may still target `/api/v2/parse-truck`.

- [ ] **Step 6: Manual browser smoke check**

Start the server:

```bash
bun run dev
```

Open:

```text
http://localhost:3000/
```

Verify:

- The first screen is the new Korean V2 UI.
- `http://localhost:3000/v2` redirects to `/`.
- Help onboarding opens and keyboard Escape, ArrowLeft, and ArrowRight still work.
- Pasting a valid truck URL creates a checked chip.
- Choosing a save folder and starting save still writes vehicle folders, not ZIP, in Chromium browsers that support File System Access.
- Unsupported browsers still fall back to ZIP.

- [ ] **Step 7: Commit any verification-only fixes**

If fixes were needed, commit each independent fix with focused files:

```bash
git add <fixed-files>
git commit -m "fix: 루트 전환 검증 오류 수정"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

**Spec coverage:**

- Root `/` loads the rebuilt page: Task 1.
- Users do not need a separate `/v2` URL: Task 1 adds root route and `/v2` redirect.
- Remove old files after cutover: Task 2 deletes legacy runtime, Sentry, watermark, shared/widgets, old API, and assets.
- Remove unused V2 prototype files and tests: Task 3.
- Remove unused dependencies: Task 4.
- Update docs/knowledge base: Task 5.
- Verify thoroughly: Task 6.

**Placeholder scan:** No task uses TBD, TODO, "similar to", or unspecified validation. Every code-changing step includes concrete file paths, exact snippets, or exact commands.

**Type consistency:** The promoted component is `TruckHarvesterApp` everywhere after Task 1. Internal `src/v2/*` imports remain unchanged except public exports removed in Task 3. `/api/v2/parse-truck` remains the active parse endpoint.
