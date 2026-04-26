import { expect, test } from '@playwright/test'

import { pasteTextInto } from './paste'

const onboardingStorageKey = 'truck-harvester:v2:onboarding'

const buildTruckUrl = (index: number) =>
  `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=${index}`

const urls = [buildTruckUrl(1), buildTruckUrl(2)]
const mixedChatText = `팀장님, 아래 두 대만 먼저 저장해 주세요.

1번 매물: ${urls[0]}
중간에 메모가 있어도 주소만 골라야 합니다.
2번 매물: ${urls[1]}

완료되면 알려주세요.`

test('saves a pasted chip workbench batch with readable listing labels', async ({
  page,
}) => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
      window.showDirectoryPicker = async () =>
        ({
          name: 'truck-test',
          async getDirectoryHandle() {
            return {
              async getFileHandle() {
                return {
                  async createWritable() {
                    return {
                      async write() {
                        return undefined
                      },
                      async close() {
                        return undefined
                      },
                    }
                  },
                }
              },
            }
          },
        }) as unknown as FileSystemDirectoryHandle
    },
    [onboardingStorageKey, 'completed']
  )

  await page.route('**/api/v2/parse-truck', async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as { url: string }
    const parsedUrl = new URL(body.url)
    const id = parsedUrl.searchParams.get('OnCarNo') ?? '1'

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          url: body.url,
          vname: `[활어차]포터2 슈퍼캡 ${id}`,
          vehicleName: `[활어차]포터2 슈퍼캡 ${id}`,
          vnumber: `부산${id.padStart(2, '0')}바5678`,
          price: {
            raw: 2400,
            rawWon: 24000000,
            label: '2,400만원',
            compactLabel: '2.4천만',
          },
          year: '2019',
          mileage: '98,000km',
          options: '활어차 / 산소공급기',
          images: [],
        },
      }),
    })
  })

  await page.goto('/v2')

  await pasteTextInto(
    page.getByRole('textbox', { name: '매물 주소' }),
    mixedChatText
  )

  const chipInput = page.getByRole('region', { name: '매물 주소 넣기' })
  await expect(chipInput.getByText('[활어차]포터2 슈퍼캡 1')).toBeVisible()
  await expect(chipInput.getByText('[활어차]포터2 슈퍼캡 2')).toBeVisible()

  const startButton = page.getByRole('button', {
    name: '확인된 2대 저장 시작',
  })
  await expect(startButton).toBeVisible()
  await startButton.click()

  await expect(page.getByText('truck-test')).toBeVisible()
  await expect(page.getByText('2대 저장 완료')).toBeVisible()
  await expect(page.getByText('truck-1')).toHaveCount(0)
})
