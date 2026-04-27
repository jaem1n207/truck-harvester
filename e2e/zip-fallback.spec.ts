import { expect, test } from '@playwright/test'

import { pasteTextInto } from './paste'
import {
  buildTruckUrl,
  installZipFallback,
  mockParseTruck,
  skipOnboarding,
} from './truck-fixtures'

test('downloads a ZIP when folder saving is unavailable', async ({ page }) => {
  await skipOnboarding(page)
  await installZipFallback(page)
  await mockParseTruck(page)

  await page.goto('/')

  await expect(page.getByText('압축 파일로 저장됩니다')).toBeVisible()
  await expect(page.getByText(/압축 파일로 내려받습니다/)).toBeVisible()

  await pasteTextInto(
    page.getByRole('textbox', { name: '매물 주소' }),
    buildTruckUrl(1)
  )

  await expect(
    page
      .getByRole('region', { name: '매물 주소 넣기' })
      .getByText('현대 메가트럭 냉동탑 1')
  ).toBeVisible()
  await page.getByRole('button', { name: '확인된 1대 저장 시작' }).click()
  await expect(
    page
      .getByRole('region', { name: '저장 진행 상황' })
      .getByText('1대 저장 완료')
  ).toBeVisible()

  const firstDownload = await page.evaluate(
    () =>
      (
        window as unknown as Window & {
          __v2ZipDownloads: { href: string; download: string }[]
        }
      ).__v2ZipDownloads[0]
  )

  expect(firstDownload).toBeDefined()
  expect(firstDownload.href).toMatch(/^blob:/)
  expect(firstDownload.download).toMatch(/^truck-data-\d{4}-\d{2}-\d{2}\.zip$/)
})
