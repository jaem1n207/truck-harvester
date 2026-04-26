import { expect, test } from '@playwright/test'

import { pasteTextInto } from './paste'

const onboardingStorageKey = 'truck-harvester:v2:onboarding'

const urls = [
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=1',
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=2',
]
const mixedChatText = `오늘 저장할 매물입니다.

첫 번째는 ${urls[0]} 이고,
두 번째는 ${urls[1]} 입니다.`

declare global {
  interface Window {
    __v2DirectoryWrites: {
      pickedFolders: string[]
      vehicleFolders: string[]
      files: string[]
      zipBlobUrls: number
    }
  }
}

test('uses the folder picked during start as the selected save folder', async ({
  page,
}) => {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)

      const writes = {
        pickedFolders: [] as string[],
        vehicleFolders: [] as string[],
        files: [] as string[],
        zipBlobUrls: 0,
      }

      Object.defineProperty(window, '__v2DirectoryWrites', {
        configurable: true,
        value: writes,
      })

      window.URL.createObjectURL = () => {
        writes.zipBlobUrls += 1
        return 'blob:unexpected-zip'
      }

      window.showDirectoryPicker = async () => {
        writes.pickedFolders.push('고른 저장 폴더')

        return {
          name: '고른 저장 폴더',
          async getDirectoryHandle(name: string) {
            writes.vehicleFolders.push(name)

            return {
              async getFileHandle(fileName: string) {
                writes.files.push(`${name}/${fileName}`)

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
        } as unknown as FileSystemDirectoryHandle
      }
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
  await page.getByRole('button', { name: '확인된 2대 저장 시작' }).click()

  await expect(page.getByText('고른 저장 폴더')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => window.__v2DirectoryWrites.vehicleFolders.length)
    )
    .toBe(2)

  const writes = await page.evaluate(() => window.__v2DirectoryWrites)

  expect(writes).toMatchObject({
    pickedFolders: ['고른 저장 폴더'],
    vehicleFolders: ['서울01가1234', '서울02가1234'],
    zipBlobUrls: 0,
  })
})
