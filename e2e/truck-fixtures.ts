import { type Page } from '@playwright/test'

export const onboardingStorageKey = 'truck-harvester:v2:onboarding'

export interface V2DirectoryWrites {
  pickedFolders: string[]
  vehicleFolders: string[]
  files: string[]
  zipBlobUrls: number
  pickerArmed: boolean
}

interface V2ZipDownload {
  href: string
  download: string
}

type MockParseShouldFailInput = {
  index: number
  url: string
}

type MockParseShouldFail =
  | boolean
  | ((input: MockParseShouldFailInput) => boolean)

interface MockParseTruckOptions {
  delayMs?: number
  shouldFail?: MockParseShouldFail
}

export const buildTruckUrl = (index: number) =>
  `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=${index}`

export const buildTruckListing = (url: string, index: number) => ({
  url,
  vname: `현대 메가트럭 냉동탑 ${index}`,
  vehicleName: `현대 메가트럭 냉동탑 ${index}`,
  vnumber: `서울${String(index).padStart(2, '0')}가${1234 + index}`,
  price: {
    raw: 3200 + index * 100,
    rawWon: (3200 + index * 100) * 10000,
    label: `${(3200 + index * 100).toLocaleString('ko-KR')}만원`,
    compactLabel: `${((3200 + index * 100) / 1000).toFixed(1)}천만`,
  },
  year: `20${19 + index}`,
  mileage: `${80_000 + index * 12_500}km`,
  options: '냉동탑 / 후방카메라 / 블랙박스',
  images: [],
})

export async function skipOnboarding(page: Page) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
    },
    [onboardingStorageKey, 'completed']
  )
}

export async function installDirectSave(page: Page, folderName = 'truck-test') {
  await page.addInitScript((selectedFolderName) => {
    const writes: V2DirectoryWrites = {
      pickedFolders: [],
      vehicleFolders: [],
      files: [],
      zipBlobUrls: 0,
      pickerArmed: false,
    }

    const createWritable = async () => ({
      async write() {
        return undefined
      },
      async close() {
        return undefined
      },
    })

    const createDirectoryHandle = (
      name: string,
      isRoot = false
    ): FileSystemDirectoryHandle =>
      ({
        name,
        kind: 'directory',
        async queryPermission() {
          return 'granted'
        },
        async requestPermission() {
          return 'granted'
        },
        async getDirectoryHandle(childName: string) {
          if (isRoot) {
            writes.vehicleFolders.push(childName)
          }

          return createDirectoryHandle(childName)
        },
        async getFileHandle(fileName: string) {
          writes.files.push(isRoot ? fileName : `${name}/${fileName}`)

          return { createWritable }
        },
      }) as unknown as FileSystemDirectoryHandle

    Object.defineProperty(window, '__v2DirectoryWrites', {
      configurable: true,
      value: writes,
    })

    window.showDirectoryPicker = async () => {
      writes.pickedFolders.push(selectedFolderName)

      return createDirectoryHandle(selectedFolderName, true)
    }
  }, folderName)
}

export async function installZipFallback(page: Page) {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showDirectoryPicker')

    Object.defineProperty(window, '__v2ZipDownloads', {
      configurable: true,
      value: [],
    })
    const e2eWindow = window as unknown as Window & {
      __v2ZipDownloads: V2ZipDownload[]
    }

    let blobUrlIndex = 0

    window.URL.createObjectURL = () => {
      blobUrlIndex += 1

      return `blob:v2-zip-${blobUrlIndex}`
    }
    window.URL.revokeObjectURL = () => undefined

    const originalCreateElement = Document.prototype.createElement

    Document.prototype.createElement = function (
      this: Document,
      tagName: string,
      options?: ElementCreationOptions
    ) {
      const element = originalCreateElement.call(this, tagName, options)

      if (tagName.toLowerCase() === 'a') {
        const anchor = element as HTMLAnchorElement

        anchor.click = () => {
          e2eWindow.__v2ZipDownloads.push({
            href: anchor.href,
            download: anchor.download,
          })
        }
      }

      return element
    } as Document['createElement']
  })
}

export async function mockParseTruck(
  page: Page,
  { delayMs = 0, shouldFail = false }: MockParseTruckOptions = {}
) {
  await page.route('**/api/v2/parse-truck', async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as { url: string }
    const parsedUrl = new URL(body.url)
    const index = Number(parsedUrl.searchParams.get('OnCarNo') ?? '1')
    const fail =
      typeof shouldFail === 'function'
        ? shouldFail({ index, url: body.url })
        : shouldFail

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    if (fail) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          reason: 'site-timeout',
          message: '사이트 응답이 늦습니다. 다시 시도해볼까요?',
        }),
      })
      return
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: buildTruckListing(body.url, index),
      }),
    })
  })
}
