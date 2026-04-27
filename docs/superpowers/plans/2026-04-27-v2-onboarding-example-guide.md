# V2 Onboarding Example Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `/v2` onboarding tour so each of the existing three spotlight steps explains the user action with a compact Korean example card and supports left/right arrow navigation.

**Architecture:** Keep the existing custom spotlight tour and add structured example metadata to each `TourStep`. Render examples through a small focused `TourExampleCard` component so `TourOverlay` remains responsible for geometry, focus, and navigation only. Add arrow-key handling inside the dialog without stealing caret movement from inputs or textareas.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Motion (`motion/react`), lucide-react, Tailwind CSS 4, Vitest, JSDOM.

---

## Scope And Constraints

- Work only inside `src/v2/features/onboarding/*`, `src/v2/testing/*`, and `docs/decisions/*`.
- Do not change legacy `/`, `src/shared/*`, `src/widgets/*`, or `src/app/page.tsx`.
- Do not add a third-party tour library.
- Do not add Sentry or watermark behavior to `/v2`.
- Keep user-facing copy Korean-only and non-technical.
- Keep the tour at exactly three steps.
- Do not reintroduce selected save folder remembering.
- Keep animations short and based on the existing `/v2` Motion presets.

## Scope Check

The spec covers one subsystem: the `/v2` onboarding tour. It does not need to be split into multiple plans.

## File Structure

- Modify `src/v2/features/onboarding/lib/tour-steps.ts`
  - Adds `TourExampleKind`.
  - Adds `exampleKind` to `TourStep`.
  - Updates the first-step copy to the approved browser-address-bar wording.
- Modify `src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts`
  - Locks the three example kinds and approved copy.
  - Keeps the Korean-only, non-technical wording guard.
- Create `src/v2/features/onboarding/ui/tour-example-card.tsx`
  - Renders compact examples for address input, save folder output, and save progress.
  - Has no state and does not mutate the real app.
- Create `src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx`
  - Covers the three example cards with static markup.
- Modify `src/v2/features/onboarding/ui/tour-overlay.tsx`
  - Renders `TourExampleCard`.
  - Adds `ArrowLeft` and `ArrowRight` keyboard navigation.
  - Ignores arrow navigation when the key event starts inside editable controls.
- Modify `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`
  - Covers example rendering in the dialog.
  - Covers arrow navigation, last-step completion via `onNext`, and editable-target ignore behavior.
- Modify `docs/decisions/0005-onboarding-tour-strategy.md`
  - Documents compact example cards and arrow-key navigation as part of the accepted custom tour.
- Modify `src/v2/testing/__tests__/knowledge-base.test.ts`
  - Adds a small guard that ADR-0005 documents the example-card and keyboard-navigation behavior.

---

## Task 1: Add Example Metadata To Tour Steps

**Files:**

- Modify: `src/v2/features/onboarding/lib/tour-steps.ts`
- Modify: `src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts`

- [ ] **Step 1: Write the failing tour-step tests**

Update `src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { findTourAnchor, tourSteps } from '../tour-steps'

describe('tour steps', () => {
  it('defines a short Korean tour without technical jargon', () => {
    expect(tourSteps).toHaveLength(3)

    for (const step of tourSteps) {
      expect(step.title).toMatch(/[가-힣]/)
      expect(step.description).toMatch(/[가-힣]/)
      expect(`${step.title} ${step.description}`).not.toMatch(/URL|API|directory handle/)
    }
  })

  it('pairs each step with a compact example card kind', () => {
    expect(tourSteps.map((step) => step.exampleKind)).toEqual([
      'url-example',
      'folder-example',
      'progress-example',
    ])
  })

  it('explains full address-bar copying in plain staff language', () => {
    expect(tourSteps[0].title).toBe('매물 주소를 넣어요')
    expect(tourSteps[0].description).toBe(
      '주소창에 있는 매물 주소를 처음부터 끝까지 복사해 붙여넣으세요. 복사한 내용 안에 매물 주소가 들어 있으면 자동으로 찾아요.'
    )
  })

  it('uses a safe fallback when the target anchor is missing', () => {
    const fallback = {
      getAttribute: (name: string) => (name === 'data-tour' ? 'v2-page' : null),
    }
    const root = {
      querySelector: (selector: string) => (selector === '[data-tour="v2-page"]' ? fallback : null),
    }

    const anchor = findTourAnchor(tourSteps[0], root)

    expect(anchor?.getAttribute('data-tour')).toBe('v2-page')
  })

  it('only points to anchors rendered by the chip workbench', () => {
    expect(tourSteps.map((step) => step.anchorSelector)).toEqual([
      '[data-tour="url-input"]',
      '[data-tour="directory-selector"]',
      '[data-tour="processing-status"]',
    ])
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts
```

Expected: FAIL because `exampleKind` does not exist and the first-step copy still uses the old wording.

- [ ] **Step 3: Add example metadata and approved step copy**

Replace `src/v2/features/onboarding/lib/tour-steps.ts` with:

```ts
export type TourExampleKind = 'url-example' | 'folder-example' | 'progress-example'

export interface TourStep {
  id: string
  anchorSelector: string
  fallbackSelector: string
  title: string
  description: string
  exampleKind: TourExampleKind
}

export const tourSteps = [
  {
    id: 'addresses',
    anchorSelector: '[data-tour="url-input"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '매물 주소를 넣어요',
    description:
      '주소창에 있는 매물 주소를 처음부터 끝까지 복사해 붙여넣으세요. 복사한 내용 안에 매물 주소가 들어 있으면 자동으로 찾아요.',
    exampleKind: 'url-example',
  },
  {
    id: 'save-folder',
    anchorSelector: '[data-tour="directory-selector"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '저장할 곳을 고르세요',
    description: '사진과 차량 정보가 선택한 폴더 안에 차량별로 정리됩니다.',
    exampleKind: 'folder-example',
  },
  {
    id: 'progress',
    anchorSelector: '[data-tour="processing-status"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '저장되는지 확인해요',
    description: '저장 중인 매물과 저장이 끝난 매물을 여기서 확인할 수 있어요.',
    exampleKind: 'progress-example',
  },
] as const satisfies readonly TourStep[]

export function findTourAnchor(step: TourStep, root: Pick<Document, 'querySelector'> = document) {
  return root.querySelector(step.anchorSelector) ?? root.querySelector(step.fallbackSelector)
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/v2/features/onboarding/lib/tour-steps.ts src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts
git commit -m "feat: v2 온보딩 예시 단계 정의"
```

---

## Task 2: Build Compact Tour Example Cards

**Files:**

- Create: `src/v2/features/onboarding/ui/tour-example-card.tsx`
- Create: `src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx`

- [ ] **Step 1: Write the failing example-card tests**

Create `src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TourExampleCard } from '../tour-example-card'

describe('TourExampleCard', () => {
  it('shows the full address example and the confirmed chip result', () => {
    const html = renderToStaticMarkup(<TourExampleCard kind="url-example" />)

    expect(html).toContain('주소창 전체 복사')
    expect(html).toContain('https://www.truck-no1.co.kr/model/DetailView.asp?')
    expect(html).toContain('DetailView.asp?...처럼 앞부분이 빠진 주소')
    expect(html).toContain('덤프 메가트럭 4.5톤')
    expect(html).toContain('확인 완료')
  })

  it('shows the selected folder and per-truck folder result', () => {
    const html = renderToStaticMarkup(<TourExampleCard kind="folder-example" />)

    expect(html).toContain('저장 폴더 고르기')
    expect(html).toContain('truck-test')
    expect(html).toContain('서울80바1234')
    expect(html).toContain('차량정보.txt')
  })

  it('shows saving, saved, and optional notification examples', () => {
    const html = renderToStaticMarkup(<TourExampleCard kind="progress-example" />)

    expect(html).toContain('저장 중')
    expect(html).toContain('저장 완료')
    expect(html).toContain('완료 알림')
    expect(html).toContain('원하면 켤 수 있어요')
  })

  it('keeps user-facing copy Korean and avoids technical backend words', () => {
    const html = renderToStaticMarkup(<TourExampleCard kind="progress-example" />)

    expect(html).toMatch(/[가-힣]/)
    expect(html).not.toMatch(/API|Sentry|watermark|directory handle/)
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx
```

Expected: FAIL because `tour-example-card.tsx` does not exist.

- [ ] **Step 3: Implement the example-card component**

Create `src/v2/features/onboarding/ui/tour-example-card.tsx`:

```tsx
import { type ReactNode } from 'react'

import { Bell, CheckCircle2, FolderOpen, LoaderCircle, type LucideIcon } from 'lucide-react'

import { type TourExampleKind } from '../lib/tour-steps'

interface TourExampleCardProps {
  kind: TourExampleKind
}

interface ExampleShellProps {
  label: string
  icon: LucideIcon
  children: ReactNode
}

const ExampleShell = ({ label, icon: Icon, children }: ExampleShellProps) => (
  <div
    aria-label={label}
    className="bg-muted/40 border-border mt-4 rounded-lg border p-3"
    data-tour-example={label}
  >
    <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium">
      <Icon aria-hidden="true" className="size-4" />
      <span>{label}</span>
    </div>
    {children}
  </div>
)

const UrlExample = () => (
  <ExampleShell icon={CheckCircle2} label="주소 예시">
    <div className="grid gap-2 text-sm">
      <div>
        <p className="text-foreground font-medium">주소창 전체 복사</p>
        <p className="text-muted-foreground font-mono text-xs break-all">
          https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=...
        </p>
      </div>
      <div className="border-border bg-background rounded-md border px-3 py-2">
        <p className="text-foreground font-medium">덤프 메가트럭 4.5톤</p>
        <p className="text-xs font-medium text-emerald-700">확인 완료</p>
      </div>
      <p className="text-muted-foreground text-xs">
        DetailView.asp?...처럼 앞부분이 빠진 주소는 찾지 못할 수 있어요.
      </p>
    </div>
  </ExampleShell>
)

const FolderExample = () => (
  <ExampleShell icon={FolderOpen} label="저장 예시">
    <div className="grid gap-2 text-sm">
      <div className="border-border bg-background flex items-center gap-2 rounded-md border px-3 py-2">
        <FolderOpen aria-hidden="true" className="text-primary size-4" />
        <div>
          <p className="text-muted-foreground text-xs">저장 폴더 고르기</p>
          <p className="text-foreground font-medium">truck-test</p>
        </div>
      </div>
      <pre className="text-muted-foreground overflow-x-auto rounded-md text-xs leading-relaxed">
        {`truck-test
└─ 서울80바1234
   ├─ 사진 1
   ├─ 사진 2
   └─ 차량정보.txt`}
      </pre>
    </div>
  </ExampleShell>
)

const ProgressExample = () => (
  <ExampleShell icon={LoaderCircle} label="진행 예시">
    <div className="grid gap-2 text-sm">
      <div className="border-border bg-background flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <span className="text-foreground font-medium">덤프 메가트럭 4.5톤</span>
        <span className="text-muted-foreground text-xs font-medium">저장 중</span>
      </div>
      <div className="border-border bg-background flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <span className="text-foreground font-medium">카고 마이티</span>
        <span className="text-xs font-medium text-emerald-700">저장 완료</span>
      </div>
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <Bell aria-hidden="true" className="size-4" />
        완료 알림도 원하면 켤 수 있어요.
      </p>
    </div>
  </ExampleShell>
)

export function TourExampleCard({ kind }: TourExampleCardProps) {
  if (kind === 'url-example') {
    return <UrlExample />
  }

  if (kind === 'folder-example') {
    return <FolderExample />
  }

  return <ProgressExample />
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/v2/features/onboarding/ui/tour-example-card.tsx src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx
git commit -m "feat: v2 온보딩 예시 카드 추가"
```

---

## Task 3: Render Examples In The Tour And Add Arrow Navigation

**Files:**

- Modify: `src/v2/features/onboarding/ui/tour-overlay.tsx`
- Modify: `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`

- [ ] **Step 1: Add failing overlay tests for examples and arrow keys**

Append these tests inside `describe('TourOverlay', () => { ... })` in `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`:

```tsx
it('renders the current step example card inside the dialog', () => {
  const html = renderToStaticMarkup(
    <TourOverlay
      currentStep={0}
      isOpen
      onClose={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      steps={tourSteps}
    />
  )

  expect(html).toContain('주소창 전체 복사')
  expect(html).toContain('덤프 메가트럭 4.5톤')
  expect(html).toContain('DetailView.asp?...처럼 앞부분이 빠진 주소')
})

it('uses left and right arrow keys for tour navigation', async () => {
  const onNext = vi.fn()
  const onPrevious = vi.fn()

  installDom()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(
      <TourOverlay
        currentStep={1}
        isOpen
        onClose={vi.fn()}
        onNext={onNext}
        onPrevious={onPrevious}
        steps={tourSteps}
      />
    )
  })

  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')

  await act(async () => {
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowLeft',
      })
    )
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowRight',
      })
    )
  })

  expect(onPrevious).toHaveBeenCalledTimes(1)
  expect(onNext).toHaveBeenCalledTimes(1)
})

it('does not move before the first step when ArrowLeft is pressed', async () => {
  const onPrevious = vi.fn()

  installDom()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(
      <TourOverlay
        currentStep={0}
        isOpen
        onClose={vi.fn()}
        onNext={vi.fn()}
        onPrevious={onPrevious}
        steps={tourSteps}
      />
    )
  })

  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')

  await act(async () => {
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowLeft',
      })
    )
  })

  expect(onPrevious).not.toHaveBeenCalled()
})

it('lets ArrowRight on the last step use the same next handler as finish', async () => {
  const onNext = vi.fn()

  installDom()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(
      <TourOverlay
        currentStep={tourSteps.length - 1}
        isOpen
        onClose={vi.fn()}
        onNext={onNext}
        onPrevious={vi.fn()}
        steps={tourSteps}
      />
    )
  })

  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')

  expect(container.textContent).toContain('마치기')

  await act(async () => {
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowRight',
      })
    )
  })

  expect(onNext).toHaveBeenCalledTimes(1)
})

it('keeps arrow keys available for text editing inside editable controls', async () => {
  const onNext = vi.fn()
  const onPrevious = vi.fn()

  installDom()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(
      <TourOverlay
        currentStep={1}
        isOpen
        onClose={vi.fn()}
        onNext={onNext}
        onPrevious={onPrevious}
        steps={tourSteps}
      />
    )
  })

  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
  const textarea = document.createElement('textarea')
  dialog?.append(textarea)

  await act(async () => {
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowRight',
      })
    )
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowLeft',
      })
    )
  })

  expect(onNext).not.toHaveBeenCalled()
  expect(onPrevious).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the focused overlay test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx
```

Expected: FAIL because the overlay does not render example cards and does not handle arrow-key navigation.

- [ ] **Step 3: Integrate the example card and arrow-key behavior**

Update `src/v2/features/onboarding/ui/tour-overlay.tsx`.

Add this import:

```ts
import { TourExampleCard } from './tour-example-card'
```

Change the popover size:

```ts
const popoverSize = {
  width: 384,
  height: 340,
} as const
```

Add this helper near `getFocusableElements`:

```ts
const isEditableKeyTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  )
}
```

Add this branch near the top of `handleDialogKeyDown`, after the Escape branch and before the Tab branch:

```ts
if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
  if (isEditableKeyTarget(event.target)) {
    return
  }

  if (event.key === 'ArrowLeft') {
    if (!isFirstStep) {
      event.preventDefault()
      onPrevious()
    }

    return
  }

  event.preventDefault()
  onNext()
  return
}
```

Render the example card between the description block and the controls:

```tsx
        <TourExampleCard kind={step.exampleKind} />

        <div className="mt-5 flex flex-wrap justify-end gap-2">
```

- [ ] **Step 4: Run the focused overlay test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run all onboarding tests**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/v2/features/onboarding/ui/tour-overlay.tsx src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx
git commit -m "feat: v2 온보딩 방향키 이동 추가"
```

---

## Task 4: Update Onboarding Decision Docs And Run Verification

**Files:**

- Modify: `docs/decisions/0005-onboarding-tour-strategy.md`
- Modify: `src/v2/testing/__tests__/knowledge-base.test.ts`

- [ ] **Step 1: Write the failing knowledge-base guard**

Add this test to `src/v2/testing/__tests__/knowledge-base.test.ts`:

```ts
it('documents the onboarding tour example cards and keyboard movement', () => {
  const decision = readText('docs/decisions/0005-onboarding-tour-strategy.md')

  expect(decision).toContain('compact example cards')
  expect(decision).toContain('ArrowLeft')
  expect(decision).toContain('ArrowRight')
  expect(decision).toContain('editable controls')
})
```

- [ ] **Step 2: Run the knowledge-base test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/knowledge-base.test.ts
```

Expected: FAIL because ADR-0005 does not yet document compact example cards or arrow-key behavior.

- [ ] **Step 3: Update ADR-0005**

Replace the `Decision` section in `docs/decisions/0005-onboarding-tour-strategy.md` with:

```md
## Decision

Build a custom onboarding tour using the existing `/v2` UI primitives and
Motion presets. Each step uses a stable anchor and a safe fallback when the
anchor is missing.

The tour uses a spotlight overlay: the active `data-tour` anchor stays
visible, unrelated page regions are dimmed, and the explanation card is
placed near the active element. The tour supports previous/next controls and
keeps animation limited to opacity, transform, and position changes through
`/v2` Motion presets with reduced-motion fallbacks.

Each step may render compact example cards that show the user action and
the expected result without mutating real page state. The address step shows
an address-bar copy example and confirmed listing chip, the save-folder step
shows the selected folder and per-truck folder result, and the progress step
shows saving, saved, and optional completion-notification examples.

Keyboard movement mirrors the visible controls: `ArrowLeft` moves to the
previous step, `ArrowRight` moves to the next step or finishes on the last
step, and `Escape` closes the tour. Arrow-key movement is ignored when the
event starts in editable controls so text caret movement remains normal.
```

- [ ] **Step 4: Run the knowledge-base test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/testing/__tests__/knowledge-base.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run focused feature verification**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx src/v2/testing/__tests__/knowledge-base.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run repository quality checks**

Run:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts src/v2/features/onboarding/ui/__tests__/tour-example-card.test.tsx src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx src/v2/testing/__tests__/knowledge-base.test.ts
```

Expected: all commands pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add docs/decisions/0005-onboarding-tour-strategy.md src/v2/testing/__tests__/knowledge-base.test.ts
git commit -m "docs: v2 온보딩 예시 안내 결정 갱신"
```

---

## Final Manual QA

- [ ] Start the dev server:

```bash
bun dev
```

- [ ] Open `/v2` and click `도움말`.
- [ ] Confirm step 1 highlights `매물 주소 넣기` and shows the full address example, the short-address warning, and the `덤프 메가트럭 4.5톤` confirmed chip example.
- [ ] Press `→` and confirm step 2 highlights `저장 폴더 선택` and shows the `truck-test` folder tree example.
- [ ] Press `→` and confirm step 3 highlights `저장 진행 상황` and shows `저장 중`, `저장 완료`, and completion-notification copy.
- [ ] Press `←` and confirm it moves back one step.
- [ ] Press `Esc` and confirm the tour closes.
- [ ] Turn on reduced motion in the browser or operating system and confirm the tour still appears without jarring movement.

## Self-Review Checklist

- Spec coverage:
  - Three-step tour preserved: Tasks 1 and 3.
  - User-action examples added: Tasks 1, 2, and 3.
  - Full address-bar copy guidance added: Tasks 1 and 2.
  - Folder result preview added: Task 2.
  - Progress and optional notification examples added: Task 2.
  - Arrow-key previous/next behavior added: Task 3.
  - Editable controls ignored for arrow navigation: Task 3.
  - ADR sync added: Task 4.
- Placeholder scan: no placeholder markers or deferred implementation instructions.
- Type consistency:
  - `TourExampleKind` is defined in `tour-steps.ts`.
  - `TourStep.exampleKind` is consumed by `TourExampleCard`.
  - `TourExampleCard.kind` uses the same `TourExampleKind` union.
  - `onNext` remains the single finish path on the final step.
