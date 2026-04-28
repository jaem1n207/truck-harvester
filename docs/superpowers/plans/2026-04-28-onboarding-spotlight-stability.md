# Onboarding Spotlight Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the first-visit onboarding spotlight aligned with `매물 주소 넣기` when the page opens from a cold visit, reload, or tab restore.

**Architecture:** The root app should not open the tour until browser-only capability panels have settled their first client state. The tour overlay should also remeasure its active anchor across the first few animation frames and when page restore, DOM child changes, viewport changes, or font readiness can move the anchor without a resize/scroll event.

**Tech Stack:** Next.js App Router, React 19, Motion/React, TypeScript strict mode, Vitest, Playwright.

---

## Root Cause

The root app renders hydration-safe defaults first: file-system support is `false`, completion notifications are hidden, and the onboarding store is initialized in an earlier `useEffect`. Immediately afterward, zero-delay effects reveal browser-only panels. Because the full-height grid distributes vertical free space, the left `매물 주소 넣기` card moves upward after the tour has already called `getBoundingClientRect()`. The current overlay only remeasures on `resize` and `scroll`, so this first-open layout shift leaves the highlight stale.

## File Structure

- Modify `src/app/truck-harvester-app.tsx`: detect browser-only capabilities before opening the tour, and open the tour on the next animation frame after those state updates.
- Modify `src/v2/features/onboarding/ui/tour-overlay.tsx`: remeasure spotlight geometry after first open and on layout-affecting browser signals.
- Modify `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`: prove the overlay remeasures after DOM changes.
- Modify `e2e/onboarding.spec.ts`: prove the first spotlight remains aligned after initial client-only controls settle.
- Modify `docs/decisions/0005-onboarding-tour-strategy.md`: record the layout-stability rule for future tour work.

### Task 1: Gate First Tour Open Until Client Layout Settles

**Files:**

- Modify: `src/app/truck-harvester-app.tsx`

- [ ] **Step 1: Replace the three mount effects with one layout-safe mount effect**

Use an isomorphic layout effect so the browser-only panels update before the tour opens:

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const requestNextFrame = (callback: () => void) => {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }

  return window.setTimeout(callback, 16)
}

const cancelNextFrame = (handle: number) => {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle)
    return
  }

  window.clearTimeout(handle)
}
```

Replace the separate onboarding, file-system, and notification effects with:

```tsx
useBrowserLayoutEffect(() => {
  const supported = isFileSystemAccessAvailable()
  setFileSystemSupported(supported)
  setDirectoryPermissionState('ready')

  if (isCompletionNotificationAvailable()) {
    setNotificationAvailable(true)
    setNotificationPermission(window.Notification.permission)
  }

  const frame = requestNextFrame(() => {
    onboardingStore.getState().initializeTour()
  })

  return () => {
    cancelNextFrame(frame)
  }
}, [onboardingStore])
```

- [ ] **Step 2: Run typecheck for the app file**

Run: `bun run typecheck`

Expected: PASS with no TypeScript errors.

### Task 2: Remeasure Tour Geometry During First-Open Layout Stabilization

**Files:**

- Modify: `src/v2/features/onboarding/ui/tour-overlay.tsx`
- Modify: `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`

- [ ] **Step 1: Add frame scheduling helpers**

Add these helpers near `toFixedPx`:

```tsx
const initialLayoutStabilityFrames = 8

const requestLayoutFrame = (callback: FrameRequestCallback) => {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }

  return window.setTimeout(() => callback(Date.now()), 16)
}

const cancelLayoutFrame = (handle: number) => {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle)
    return
  }

  window.clearTimeout(handle)
}
```

- [ ] **Step 2: Replace the geometry effect**

The effect must immediately measure, keep measuring for eight frames, observe child-list changes, react to page restore, and listen to the visual viewport:

```tsx
useEffect(() => {
  if (!isOpen || typeof window === 'undefined') {
    return
  }

  let isCancelled = false
  let updateFrame: number | null = null
  let stabilityFrame: number | null = null

  const updateGeometry = () => {
    const viewport = getViewportRect()
    const anchor = findTourAnchor(step, document)
    const target = anchor ? getElementRect(anchor) : fallbackTarget
    const spotlight = getSpotlightRect(target, viewport)

    setGeometry({
      spotlight,
      popover: getPopoverPosition(spotlight, viewport, popoverSize),
      viewport,
    })
  }

  const scheduleGeometryUpdate = () => {
    if (updateFrame !== null) {
      cancelLayoutFrame(updateFrame)
    }

    updateFrame = requestLayoutFrame(() => {
      updateFrame = null

      if (!isCancelled) {
        updateGeometry()
      }
    })
  }

  const scheduleInitialStabilityUpdates = (remainingFrames: number) => {
    if (remainingFrames <= 0 || isCancelled) {
      return
    }

    stabilityFrame = requestLayoutFrame(() => {
      if (!isCancelled) {
        updateGeometry()
        scheduleInitialStabilityUpdates(remainingFrames - 1)
      }
    })
  }

  updateGeometry()
  scheduleInitialStabilityUpdates(initialLayoutStabilityFrames)

  const mutationObserver =
    typeof MutationObserver === 'function' ? new MutationObserver(scheduleGeometryUpdate) : null
  mutationObserver?.observe(document.body, { childList: true, subtree: true })

  const activeAnchor = findTourAnchor(step, document)
  const resizeObserver =
    typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleGeometryUpdate) : null

  if (activeAnchor) {
    resizeObserver?.observe(activeAnchor)
  }

  const documentWithFonts = document as Document & {
    fonts?: { ready?: Promise<unknown> }
  }
  void documentWithFonts.fonts?.ready?.then(() => {
    if (!isCancelled) {
      scheduleGeometryUpdate()
    }
  })

  window.addEventListener('resize', scheduleGeometryUpdate)
  window.addEventListener('scroll', scheduleGeometryUpdate, true)
  window.addEventListener('pageshow', scheduleGeometryUpdate)
  window.visualViewport?.addEventListener('resize', scheduleGeometryUpdate)
  window.visualViewport?.addEventListener('scroll', scheduleGeometryUpdate)

  return () => {
    isCancelled = true
    mutationObserver?.disconnect()
    resizeObserver?.disconnect()
    window.removeEventListener('resize', scheduleGeometryUpdate)
    window.removeEventListener('scroll', scheduleGeometryUpdate, true)
    window.removeEventListener('pageshow', scheduleGeometryUpdate)
    window.visualViewport?.removeEventListener('resize', scheduleGeometryUpdate)
    window.visualViewport?.removeEventListener('scroll', scheduleGeometryUpdate)

    if (updateFrame !== null) {
      cancelLayoutFrame(updateFrame)
    }

    if (stabilityFrame !== null) {
      cancelLayoutFrame(stabilityFrame)
    }
  }
}, [isOpen, step])
```

- [ ] **Step 3: Add a unit regression for DOM-driven movement**

In `tour-overlay.test.tsx`, install `requestAnimationFrame` and a mutable anchor rect. Render an anchor before `TourOverlay`, move the anchor, append a child to trigger `MutationObserver`, flush the scheduled frame, and assert that `[data-tour-highlight]` moved to the new top.

Run: `bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`

Expected: PASS.

### Task 3: Add Browser-Level Regression Coverage

**Files:**

- Modify: `e2e/onboarding.spec.ts`

- [ ] **Step 1: Add a spotlight alignment helper**

```ts
const spotlightPadding = 10
const alignmentTolerance = 3

async function getFirstStepAlignment(page: import('@playwright/test').Page) {
  return page.evaluate(
    ({ padding, tolerance }) => {
      const anchor = document.querySelector('[data-tour="url-input"]')
      const highlight = document.querySelector('[data-tour-highlight="true"]')

      if (!anchor || !highlight) {
        return false
      }

      const anchorRect = anchor.getBoundingClientRect()
      const highlightRect = highlight.getBoundingClientRect()
      const expectedLeft = Math.max(anchorRect.left - padding, 0)
      const expectedTop = Math.max(anchorRect.top - padding, 0)
      const expectedWidth = anchorRect.width + padding * 2
      const expectedHeight = anchorRect.height + padding * 2

      return (
        Math.abs(highlightRect.left - expectedLeft) <= tolerance &&
        Math.abs(highlightRect.top - expectedTop) <= tolerance &&
        Math.abs(highlightRect.width - expectedWidth) <= tolerance &&
        Math.abs(highlightRect.height - expectedHeight) <= tolerance
      )
    },
    { padding: spotlightPadding, tolerance: alignmentTolerance }
  )
}
```

- [ ] **Step 2: Add the regression test**

```ts
test('keeps the first spotlight aligned after initial layout settles', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '매물 주소를 넣어요' })).toBeVisible()

  await expect.poll(() => getFirstStepAlignment(page)).toBe(true)
  await page.waitForTimeout(250)
  await expect.poll(() => getFirstStepAlignment(page)).toBe(true)
})
```

Run: `bun run test:e2e -- e2e/onboarding.spec.ts`

Expected: PASS.

### Task 4: Record the Tour Stability Rule

**Files:**

- Modify: `docs/decisions/0005-onboarding-tour-strategy.md`

- [ ] **Step 1: Add a context sentence**

```md
The tour opens only after browser-only capability controls finish their first
client-side layout pass, then keeps measuring the active anchor during initial
layout stabilization and tab restore.
```

- [ ] **Step 2: Run documentation formatting check**

Run: `bun run format:check`

Expected: PASS.

### Task 5: Final Verification

**Files:**

- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx src/app/__tests__/truck-harvester-app.test.tsx
bun run test:e2e -- e2e/onboarding.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run broad safety checks**

Run:

```bash
bun run typecheck
bun run lint
bun run format:check
```

Expected: PASS.

## Self-Review

- Spec coverage: Covers first entry, reload, and tab restore by delaying first tour open and remeasuring on `pageshow`, initial animation frames, DOM changes, visual viewport changes, resize, scroll, and font readiness.
- Placeholder scan: No placeholders, TBDs, or vague test steps remain.
- Type consistency: `TargetRect`, `ViewportRect`, `TourStep`, and `TourOverlay` APIs remain unchanged; only internal scheduling and mount timing change.
