import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('v2 landing flow has no critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/v2')

  const results = await new AxeBuilder({ page })
    .include('[data-tour="v2-page"]')
    .analyze()
  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === 'critical'
  )

  expect(criticalViolations).toEqual([])
})
