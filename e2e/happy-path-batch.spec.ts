import { expect, test } from '@playwright/test'

import { pasteTextInto } from './paste'

const buildTruckUrl = (index: number) =>
  `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=${index}`

const urls = Array.from({ length: 10 }, (_, index) => buildTruckUrl(index + 1))
const mixedChatText = urls
  .map(
    (url, index) =>
      `사장님 ${index + 1}번 매물 확인 부탁드립니다.\n${url}\n사진까지 저장해 주세요.`
  )
  .join('\n\n')
const onboardingStorageKey = 'truck-harvester:v2:onboarding'

test('completes a 10-address batch with streamed parsed results', async ({
  page,
}) => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
      window.showDirectoryPicker = async () =>
        ({
          name: '테스트 저장 폴더',
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
          vname: `현대 마이티 ${id}`,
          vehicleName: `현대 마이티 ${id}`,
          vnumber: `서울${id.padStart(2, '0')}가1234`,
          price: {
            raw: 3550,
            rawWon: 35500000,
            label: '3,550만원',
            compactLabel: '3.6천만',
          },
          year: '2020',
          mileage: '150,000km',
          options: '냉동탑 / 후방카메라',
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
  await expect(chipInput.getByText('현대 마이티 10')).toBeVisible()
  const statusPanel = page.getByRole('region', { name: '저장 진행 상황' })

  await page.getByRole('button', { name: '확인된 10대 저장 시작' }).click()

  await expect(statusPanel.getByText('10대 저장 완료')).toBeVisible()
  await expect(statusPanel.getByText('현대 마이티 10')).toBeVisible()
  await expect(chipInput.getByText('현대 마이티 10')).toHaveCount(0)
  await expect(page.getByText('주목 필요')).toHaveCount(0)
})
