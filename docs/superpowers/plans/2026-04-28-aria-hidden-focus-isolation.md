# ARIA Hidden Focus Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent onboarding from leaving focusable page controls exposed behind the modal tour without using `aria-hidden` on those controls.

**Architecture:** Keep the existing custom tour overlay and isolate only the background app surface while the tour dialog is open. Use the native `inert` attribute on the background section, not `aria-hidden`, and explicitly disable background buttons and the address textarea so accessibility scanners do not see focusable descendants inside the hidden app surface.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Vitest with JSDOM, Playwright with axe-core.

---

## File Structure

- Modify `src/app/truck-harvester-app.tsx`: mark the root app content section as inert while `onboardingState.isTourOpen` is true, add a stable test selector, and pass disabled state to background controls.
- Modify `src/v2/features/onboarding/ui/help-menu-button.tsx`: accept a disabled prop for the header help control.
- Modify `src/v2/widgets/directory-selector/ui/directory-selector.tsx`: accept a disabled prop for the save-folder control.
- Modify `src/v2/features/completion-notification/ui/completion-notification-toggle.tsx`: accept a disabled prop for the optional notification control.
- Modify `src/app/__tests__/truck-harvester-app.test.tsx`: prove the background section becomes inert, avoids `aria-hidden`, and disables the four focusable background controls while the tour dialog is open.
- Modify `e2e/a11y.spec.ts`: assert the live browser page has no `aria-hidden-focus` axe violation and that background isolation uses `inert` plus disabled controls.

### Task 1: Isolate Background Content With Inert

**Files:**

- Modify: `src/app/truck-harvester-app.tsx`

- [ ] **Step 1: Add inert to the root app content section**

Replace the root content section opening tag with:

```tsx
<section
  className="mx-auto grid min-h-dvh w-full max-w-6xl gap-6 px-6 py-8 md:px-10"
  data-tour-background="true"
  inert={isTourOpen ? true : undefined}
>
```

- [ ] **Step 2: Run focused typecheck**

Run: `bun run typecheck`

Expected: PASS with no TypeScript errors.

### Task 2: Add Unit Coverage For Modal Background Isolation

**Files:**

- Modify: `src/app/__tests__/truck-harvester-app.test.tsx`

- [ ] **Step 1: Add a focused JSDOM test**

Add this test inside `describe('TruckHarvesterApp persistence', () => { ... })`:

```tsx
it('disables the four background controls while onboarding is open', async () => {
  const restoredDirectory = createTestDirectoryHandle()

  installDom(restoredDirectory)
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('default'),
    },
  })
  const { TruckHarvesterApp } = await import('../truck-harvester-app')

  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(<TruckHarvesterApp />)
  })

  const helpButton = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('도움말')
  )

  expect(helpButton).toBeInstanceOf(HTMLButtonElement)

  await act(async () => {
    helpButton?.dispatchEvent(new dom!.window.MouseEvent('click', { bubbles: true }))
  })

  const background = container.querySelector<HTMLElement>('[data-tour-background="true"]')
  const dialog = container.querySelector<HTMLElement>('[data-tour-modal-root="true"]')

  expect(dialog).toBeInstanceOf(HTMLElement)
  expect(background?.hasAttribute('inert')).toBe(true)
  expect(background?.getAttribute('aria-hidden')).toBeNull()

  const textarea = container.querySelector<HTMLTextAreaElement>('#listing-chip-input-textarea')
  const directoryButton = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === '저장 폴더 고르기'
  )
  const notificationButton = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === '완료 알림 켜기'
  )

  expect(helpButton?.disabled).toBe(true)
  expect(textarea?.disabled).toBe(true)
  expect(directoryButton?.disabled).toBe(true)
  expect(notificationButton?.disabled).toBe(true)
})
```

The `createTestDirectoryHandle()` helper should return the same minimal handle shape already used in the file:

```tsx
const createTestDirectoryHandle = (): WritableDirectoryHandle => ({
  getDirectoryHandle: async () => {
    throw new Error('테스트에서는 폴더에 쓰지 않습니다.')
  },
  getFileHandle: async () => {
    throw new Error('테스트에서는 파일에 쓰지 않습니다.')
  },
  name: 'truck-test',
  queryPermission: vi.fn().mockResolvedValue('granted'),
  requestPermission: vi.fn().mockResolvedValue('granted'),
})
```

- [ ] **Step 2: Run the focused app test**

Run: `bun run test -- --run src/app/__tests__/truck-harvester-app.test.tsx`

Expected: PASS.

### Task 3: Add Browser-Level A11y Guard

**Files:**

- Modify: `e2e/a11y.spec.ts`

- [ ] **Step 1: Assert inert is used and aria-hidden-focus is absent**

After the dialog visibility assertion, add:

```ts
const backgroundState = await page.locator('[data-tour-background="true"]').evaluate((element) => ({
  ariaHidden: element.getAttribute('aria-hidden'),
  inert: (element as HTMLElement).inert,
}))

expect(backgroundState).toEqual({
  ariaHidden: null,
  inert: true,
})

await expect(page.getByRole('button', { name: /도움말/ })).toBeDisabled()
await expect(page.locator('#listing-chip-input-textarea')).toBeDisabled()
await expect(page.getByRole('button', { name: '저장 폴더 고르기' })).toBeDisabled()
await expect(page.getByRole('button', { name: '완료 알림 켜기' })).toBeDisabled()
```

After collecting axe results, add:

```ts
const ariaHiddenFocusViolations = results.violations.filter(
  (violation) => violation.id === 'aria-hidden-focus'
)

expect(ariaHiddenFocusViolations).toEqual([])
```

- [ ] **Step 2: Run the accessibility smoke test**

Run: `bun run test:a11y`

Expected: PASS.

## Self-Review

- Spec coverage: The screenshot's `aria-hidden-focus` warning is addressed without adding `aria-hidden` to focusable page regions.
- Placeholder scan: No placeholders or deferred tasks remain.
- Type consistency: The plan uses existing component names, selectors, and test command names from this repository.
