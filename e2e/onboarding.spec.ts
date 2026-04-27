import { expect, test } from '@playwright/test'

import { onboardingStorageKey } from './truck-fixtures'

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
