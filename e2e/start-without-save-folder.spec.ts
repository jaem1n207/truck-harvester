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
      const directoryStorageKey = 'e2e:v2:selected-directory-handle'
      const createWritable = async () => ({
        async write() {
          return undefined
        },
        async close() {
          return undefined
        },
      })
      const createDirectoryHandle = (): FileSystemDirectoryHandle =>
        ({
          name: 'truck-test',
          kind: 'directory',
          async queryPermission() {
            return 'granted'
          },
          async requestPermission() {
            return 'granted'
          },
          async getDirectoryHandle(name: string) {
            writes.vehicleFolders.push(name)

            return {
              name,
              kind: 'directory',
              async queryPermission() {
                return 'granted'
              },
              async requestPermission() {
                return 'granted'
              },
              async getDirectoryHandle() {
                return this as FileSystemDirectoryHandle
              },
              async getFileHandle(fileName: string) {
                writes.files.push(`${name}/${fileName}`)

                return { createWritable }
              },
            } as unknown as FileSystemDirectoryHandle
          },
          async getFileHandle(fileName: string) {
            writes.files.push(fileName)

            return { createWritable }
          },
        }) as unknown as FileSystemDirectoryHandle

      Object.defineProperty(window, '__v2DirectoryWrites', {
        configurable: true,
        value: writes,
      })

      window.URL.createObjectURL = () => {
        writes.zipBlobUrls += 1
        return 'blob:unexpected-zip'
      }

      window.showDirectoryPicker = async () => {
        writes.pickedFolders.push('truck-test')

        return createDirectoryHandle()
      }

      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: {
          open() {
            const request = {
              error: null,
              result: {
                createObjectStore() {
                  return undefined
                },
                transaction() {
                  const transaction = {
                    error: null,
                    onabort: null as (() => void) | null,
                    oncomplete: null as (() => void) | null,
                    objectStore() {
                      return {
                        get() {
                          const getRequest = {
                            error: null,
                            result: window.localStorage.getItem(
                              directoryStorageKey
                            )
                              ? createDirectoryHandle()
                              : null,
                            onsuccess: null as (() => void) | null,
                            onerror: null as (() => void) | null,
                          }

                          window.setTimeout(() => getRequest.onsuccess?.(), 0)

                          return getRequest
                        },
                        put() {
                          const putRequest = {
                            error: null,
                            result: undefined,
                            onsuccess: null as (() => void) | null,
                            onerror: null as (() => void) | null,
                          }

                          window.localStorage.setItem(
                            directoryStorageKey,
                            'truck-test'
                          )
                          window.setTimeout(() => {
                            putRequest.onsuccess?.()
                            transaction.oncomplete?.()
                          }, 0)

                          return putRequest
                        },
                        delete() {
                          const deleteRequest = {
                            error: null,
                            result: undefined,
                            onsuccess: null as (() => void) | null,
                            onerror: null as (() => void) | null,
                          }

                          window.localStorage.removeItem(directoryStorageKey)
                          window.setTimeout(() => {
                            deleteRequest.onsuccess?.()
                            transaction.oncomplete?.()
                          }, 0)

                          return deleteRequest
                        },
                      }
                    },
                  }

                  return transaction
                },
                close() {
                  return undefined
                },
              },
              onupgradeneeded: null as (() => void) | null,
              onsuccess: null as (() => void) | null,
              onerror: null as (() => void) | null,
            }

            window.setTimeout(() => {
              request.onupgradeneeded?.()
              request.onsuccess?.()
            }, 0)

            return request
          },
        },
      })
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

  await expect(page.getByText('선택한 저장 폴더')).toBeVisible()
  await expect(page.getByText('truck-test')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => window.__v2DirectoryWrites.vehicleFolders.length)
    )
    .toBe(2)

  const writes = await page.evaluate(() => window.__v2DirectoryWrites)

  expect(writes).toMatchObject({
    pickedFolders: ['truck-test'],
    vehicleFolders: ['서울01가1234', '서울02가1234'],
    zipBlobUrls: 0,
  })

  await page.reload()

  await expect(page.getByText('선택한 저장 폴더')).toBeVisible()
  await expect(page.getByText('truck-test')).toBeVisible()
})
