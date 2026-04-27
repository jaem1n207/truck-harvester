import { expect, test } from '@playwright/test'

import { pasteTextInto } from './paste'
import {
  buildTruckUrl,
  installDirectSave,
  mockParseTruck,
  skipOnboarding,
} from './truck-fixtures'

const urls = [buildTruckUrl(1), buildTruckUrl(2), buildTruckUrl(3)]
const mixedChatText = urls
  .map((url, index) => `확인할 ${index + 1}번 매물입니다.\n${url}`)
  .join('\n\n')

test('keeps successful listings saveable while a failed parse is recovered', async ({
  page,
}) => {
  let failSecondListing = true

  await skipOnboarding(page)
  await installDirectSave(page)
  await mockParseTruck(page, {
    shouldFail: ({ index }) => index === 2 && failSecondListing,
  })

  await page.goto('/')

  const chipInput = page.getByRole('region', { name: '매물 주소 넣기' })
  const statusPanel = page.getByRole('region', { name: '저장 진행 상황' })

  await pasteTextInto(
    page.getByRole('textbox', { name: '매물 주소' }),
    mixedChatText
  )

  await expect(chipInput.getByText('현대 메가트럭 냉동탑 1')).toBeVisible()
  await expect(chipInput.getByText('현대 메가트럭 냉동탑 3')).toBeVisible()
  await expect(
    chipInput.getByText('매물 이름을 확인하지 못했어요')
  ).toBeVisible()

  await page.getByRole('button', { name: '확인된 2대 저장 시작' }).click()

  await expect(statusPanel.getByText('2대 중 2대 저장 완료')).toBeVisible()
  await expect(statusPanel.getByText('현대 메가트럭 냉동탑 1')).toBeVisible()
  await expect(statusPanel.getByText('현대 메가트럭 냉동탑 3')).toBeVisible()
  await expect(
    chipInput.getByText('매물 이름을 확인하지 못했어요')
  ).toBeVisible()

  await page
    .getByRole('button', {
      name: '매물 지우기: 매물 이름을 확인하지 못했어요',
    })
    .click()
  await expect(
    chipInput.getByText('매물 이름을 확인하지 못했어요')
  ).toHaveCount(0)

  failSecondListing = false
  await pasteTextInto(page.getByRole('textbox', { name: '매물 주소' }), urls[1])

  await expect(chipInput.getByText('현대 메가트럭 냉동탑 2')).toBeVisible()
  await page.getByRole('button', { name: '확인된 1대 저장 시작' }).click()

  await expect(statusPanel.getByText('3대 저장 완료')).toBeVisible()
  await expect(statusPanel.getByText('현대 메가트럭 냉동탑 2')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __v2DirectoryWrites: { vehicleFolders: string[] }
            }
          ).__v2DirectoryWrites.vehicleFolders.length
      )
    )
    .toBe(3)
})
