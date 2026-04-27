import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('v2 landing flow has no critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('dialog')).toBeVisible()

  const results = await new AxeBuilder({ page })
    .include('[data-tour="v2-page"]')
    .include('[data-tour-modal-root="true"]')
    .analyze()
  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === 'critical'
  )

  expect(criticalViolations).toEqual([])
})
