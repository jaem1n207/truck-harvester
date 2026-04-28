import { expect, test, type Page } from '@playwright/test'

import { onboardingStorageKey } from './truck-fixtures'

const spotlightPadding = 10
const alignmentTolerance = 3

async function isFirstStepSpotlightAligned(page: Page) {
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

test('walks through the first-visit tour and can restart it from help', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: '매물 주소를 넣어요' })
  ).toBeVisible()
  await expect(page.getByText('1 / 3')).toBeVisible()

  await page.getByRole('button', { name: '다음' }).click()
  await expect(
    page.getByRole('heading', { name: '저장할 곳을 고르세요' })
  ).toBeVisible()
  await expect(page.getByText('2 / 3')).toBeVisible()

  await page.getByRole('button', { name: '이전' }).click()
  await expect(
    page.getByRole('heading', { name: '매물 주소를 넣어요' })
  ).toBeVisible()
  await expect(page.getByText('1 / 3')).toBeVisible()

  await page.getByRole('button', { name: '다음' }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await expect(
    page.getByRole('heading', { name: '저장되는지 확인해요' })
  ).toBeVisible()
  await expect(page.getByText('3 / 3')).toBeVisible()

  await page.getByRole('button', { name: '마치기' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), onboardingStorageKey)
    )
    .toBe('completed')

  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: '매물 주소를 넣어요' })
  ).toHaveCount(0)

  await page.getByRole('button', { name: /도움말/ }).click()
  await expect(
    page.getByRole('heading', { name: '매물 주소를 넣어요' })
  ).toBeVisible()
  await expect(page.getByText('1 / 3')).toBeVisible()
})

test('keeps the first spotlight aligned after initial layout settles', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: '매물 주소를 넣어요' })
  ).toBeVisible()

  await expect.poll(() => isFirstStepSpotlightAligned(page)).toBe(true)
  await page.waitForTimeout(250)
  await expect.poll(() => isFirstStepSpotlightAligned(page)).toBe(true)
})
