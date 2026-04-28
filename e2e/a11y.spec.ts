import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('v2 landing flow has no critical accessibility violations', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeNotification {
      static permission: NotificationPermission = 'default'
      static requestPermission = async () => 'default' as NotificationPermission

      constructor(_title: string) {}
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: FakeNotification,
    })
  })
  await page.goto('/')
  await expect(page.getByRole('dialog')).toBeVisible()

  const backgroundState = await page
    .locator('[data-tour-background="true"]')
    .evaluate((element) => ({
      ariaHidden: element.getAttribute('aria-hidden'),
      inert: (element as HTMLElement).inert,
    }))

  expect(backgroundState).toEqual({
    ariaHidden: null,
    inert: true,
  })
  await expect(page.getByRole('button', { name: /도움말/ })).toBeDisabled()
  await expect(page.locator('#listing-chip-input-textarea')).toBeDisabled()
  await expect(
    page.getByRole('button', { name: '저장 폴더 고르기' })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: '완료 알림 켜기' })
  ).toBeDisabled()

  const results = await new AxeBuilder({ page })
    .include('[data-tour="v2-page"]')
    .include('[data-tour-modal-root="true"]')
    .analyze()
  const ariaHiddenFocusViolations = results.violations.filter(
    (violation) => violation.id === 'aria-hidden-focus'
  )
  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === 'critical'
  )

  expect(ariaHiddenFocusViolations).toEqual([])
  expect(criticalViolations).toEqual([])
})
