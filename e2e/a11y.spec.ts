import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('v2 landing flow has no critical accessibility violations', async ({
  page,
}) => {
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
