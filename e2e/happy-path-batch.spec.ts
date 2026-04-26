import { expect, test } from '@playwright/test'

const buildTruckUrl = (index: number) =>
  `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=${index}`

const urls = Array.from({ length: 10 }, (_, index) => buildTruckUrl(index + 1))

test('completes a 10-address batch with streamed parsed results', async ({
  page,
}) => {
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
  const closeTourButton = page.getByRole('button', { name: '그만 보기' })

  if (await closeTourButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closeTourButton.click()
  }

  await page.getByLabel('매물 주소').fill(urls.join('\n'))
  await page.getByRole('button', { name: '가져오기 시작' }).click()

  await expect(page.getByText('truck-10')).toBeVisible()
  await expect(page.getByText('정보 확인 완료').first()).toBeVisible()
  await expect(page.getByText('주목 필요')).toHaveCount(0)
})
