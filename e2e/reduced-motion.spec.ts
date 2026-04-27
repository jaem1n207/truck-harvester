import { expect, test } from '@playwright/test'

test.use({ contextOptions: { reducedMotion: 'reduce' } })

test('keeps tour elements visible without transform motion', async ({
  page,
}) => {
  await page.goto('/')

  const tourCard = page.locator('[data-motion="tour-card"]')
  const tourHighlight = page.locator('[data-motion="tour-highlight"]')

  await expect(tourCard).toBeVisible()
  await expect(tourHighlight).toBeVisible()

  await expect
    .poll(() =>
      tourCard.evaluate((element) => getComputedStyle(element).transform)
    )
    .toBe('none')
  await expect
    .poll(() =>
      tourHighlight.evaluate((element) => getComputedStyle(element).transform)
    )
    .toBe('none')
})
