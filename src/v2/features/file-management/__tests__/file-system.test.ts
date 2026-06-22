import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import {
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  requestWritableDirectoryPermission,
  saveTruckToDirectory,
  type WritableDirectoryHandle,
} from '../file-system'

const originalWindow = globalThis.window
const originalFetch = globalThis.fetch

const listing: TruckListing = {
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
  performanceCheckUrl: 'https://check.example.com/report',
  vname: '현대 마이티',
  vehicleName: '2020년 현대 마이티',
  vnumber: '12가/3456',
  price: {
    raw: 3550,
    rawWon: 35500000,
    label: '3,550만원',
    compactLabel: '3.6천만',
  },
  year: '2020',
  mileage: '150,000km',
  options: '냉동탑 / 후방카메라',
  images: [
    'https://img.example.com/one.jpg',
    'https://img.example.com/two.jpg',
  ],
}

function createWritable() {
  return {
    write: vi.fn(async (_data: FileSystemWriteChunkType) => undefined),
    close: vi.fn(async () => undefined),
  }
}

function createDirectoryHandle() {
  const writables = new Map<string, ReturnType<typeof createWritable>>()
  const directories = new Map<string, WritableDirectoryHandle>()

  function createMockDirectory(path = '') {
    return {
      getDirectoryHandle: vi.fn(async (name: string) => {
        const nextPath = path ? `${path}/${name}` : name
        const existing = directories.get(nextPath)

        if (existing) {
          return existing
        }

        const directory = createMockDirectory(nextPath)

        directories.set(
          nextPath,
          directory as unknown as WritableDirectoryHandle
        )

        return directory
      }),
      getFileHandle: vi.fn(async (name: string) => {
        const filePath = path ? `${path}/${name}` : name
        const writable = createWritable()

        writables.set(filePath, writable)

        return {
          createWritable: vi.fn(async () => writable),
        }
      }),
    }
  }

  const rootDirectory = createMockDirectory()
  const vehicleDirectory = createMockDirectory('12가_3456')
  const vehicleImagesDirectory = createMockDirectory('12가_3456/차량 이미지')
  const performanceCheckDirectory =
    createMockDirectory('12가_3456/성능점검기록부')
  const manuscriptDirectory = createMockDirectory('12가_3456/원고')

  directories.set(
    '12가_3456',
    vehicleDirectory as unknown as WritableDirectoryHandle
  )
  directories.set(
    '12가_3456/차량 이미지',
    vehicleImagesDirectory as unknown as WritableDirectoryHandle
  )
  directories.set(
    '12가_3456/성능점검기록부',
    performanceCheckDirectory as unknown as WritableDirectoryHandle
  )
  directories.set(
    '12가_3456/원고',
    manuscriptDirectory as unknown as WritableDirectoryHandle
  )

  return {
    rootDirectory: rootDirectory as unknown as WritableDirectoryHandle,
    directories,
    manuscriptDirectory,
    performanceCheckDirectory,
    vehicleDirectory,
    vehicleImagesDirectory,
    writables,
  }
}

function stubWindow(value: Record<string, unknown>) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
  })
}

function stubFetch(value: typeof fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value,
  })
}

function restoreGlobals() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: originalFetch,
  })
}

function getWrittenBlob(
  writable: ReturnType<typeof createWritable> | undefined
) {
  const [blob] = writable!.write.mock.calls[0]

  expect(blob).toBeInstanceOf(Blob)

  return blob as Blob
}

describe('v2 file-system', () => {
  afterEach(() => {
    restoreGlobals()
  })

  it('detects File System Access API support', () => {
    stubWindow({ showDirectoryPicker: vi.fn() })
    expect(isFileSystemAccessAvailable()).toBe(true)

    stubWindow({})
    expect(isFileSystemAccessAvailable()).toBe(false)
  })

  it('passes readwrite picker options when selecting a writable directory', async () => {
    const startIn = createDirectoryHandle().rootDirectory
    const selectedDirectory = createDirectoryHandle().rootDirectory
    const showDirectoryPicker = vi.fn(async () => selectedDirectory)

    stubWindow({ showDirectoryPicker })

    await expect(
      pickWritableDirectory({
        id: 'truck-harvester-v2-save-folder',
        startIn,
      })
    ).resolves.toBe(selectedDirectory)
    expect(showDirectoryPicker).toHaveBeenCalledWith({
      id: 'truck-harvester-v2-save-folder',
      mode: 'readwrite',
      startIn,
    })
  })

  it('requests readwrite permission for a writable directory', async () => {
    const requestPermission = vi.fn(async () => 'granted' as PermissionState)
    const directory = {
      requestPermission,
    } as unknown as WritableDirectoryHandle

    await expect(requestWritableDirectoryPermission(directory)).resolves.toBe(
      true
    )
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('returns false when writable directory permission fails', async () => {
    const requestPermission = vi.fn(async () => {
      throw new DOMException('권한을 확인하지 못했습니다.', 'NotAllowedError')
    })
    const directory = {
      requestPermission,
    } as unknown as WritableDirectoryHandle

    await expect(requestWritableDirectoryPermission(directory)).resolves.toBe(
      false
    )
  })

  it('saves vehicle images, performance check images, and manuscript into structured folders', async () => {
    stubFetch(
      vi.fn(async (url: string) => {
        return new Response(`image:${url}`, { status: 200 })
      }) as typeof fetch
    )
    const {
      manuscriptDirectory,
      performanceCheckDirectory,
      rootDirectory,
      vehicleDirectory,
      vehicleImagesDirectory,
      writables,
    } = createDirectoryHandle()
    const progress: Array<[number, number, number]> = []
    const capturePerformanceCheckImages = vi.fn(async () => [
      new Uint8Array([7, 8]),
      new Uint8Array([9]),
    ])

    await expect(
      saveTruckToDirectory(rootDirectory, listing, {
        capturePerformanceCheckImages,
        onProgress: (progressValue, downloaded, total) =>
          progress.push([progressValue, downloaded, total]),
      })
    ).resolves.toEqual({
      performanceCheckImageCount: 2,
      performanceCheckStatus: 'saved',
      sourceUrl: listing.url,
      vehicleImageCount: 2,
      vehicleImageStatus: 'complete',
      vehicleImageTotalCount: 2,
      vehicleFolderName: '12가_3456',
      vehicleNumber: '12가/3456',
    })

    expect(rootDirectory.getDirectoryHandle).toHaveBeenCalledWith('12가_3456', {
      create: true,
    })
    expect(vehicleDirectory.getDirectoryHandle).toHaveBeenCalledWith(
      '차량 이미지',
      { create: true }
    )
    expect(vehicleDirectory.getDirectoryHandle).toHaveBeenCalledWith(
      '성능점검기록부',
      { create: true }
    )
    expect(vehicleDirectory.getDirectoryHandle).toHaveBeenCalledWith('원고', {
      create: true,
    })
    expect(manuscriptDirectory.getFileHandle).toHaveBeenCalledWith(
      '차량정보.txt',
      { create: true }
    )
    expect(vehicleImagesDirectory.getFileHandle).toHaveBeenCalledWith(
      '사진_1.jpg',
      { create: true }
    )
    expect(vehicleImagesDirectory.getFileHandle).toHaveBeenCalledWith(
      '사진_2.jpg',
      { create: true }
    )
    expect(performanceCheckDirectory.getFileHandle).toHaveBeenCalledWith(
      '성능점검기록부_1.jpg',
      { create: true }
    )
    expect(performanceCheckDirectory.getFileHandle).toHaveBeenCalledWith(
      '성능점검기록부_2.jpg',
      { create: true }
    )
    expect(capturePerformanceCheckImages).toHaveBeenCalledWith(
      'https://check.example.com/report',
      { signal: undefined }
    )

    await expect(
      writables.get('12가_3456/원고/차량정보.txt')!.write
    ).toHaveBeenCalledWith(expect.stringContaining('차량번호 :  12가/3456'))
    await expect(
      writables.get('12가_3456/원고/차량정보.txt')!.write
    ).toHaveBeenCalledWith(expect.stringContaining('#사진:사진_1.jpg'))
    await expect(
      writables.get('12가_3456/원고/차량정보.txt')!.write
    ).not.toHaveBeenCalledWith(expect.stringContaining('K-001.jpg'))
    await expect(
      getWrittenBlob(writables.get('12가_3456/차량 이미지/사진_1.jpg')).text()
    ).resolves.toBe('image:https://img.example.com/one.jpg')
    await expect(
      getWrittenBlob(
        writables.get('12가_3456/성능점검기록부/성능점검기록부_1.jpg')
      ).arrayBuffer()
    ).resolves.toEqual(new Uint8Array([7, 8]).buffer)
    expect(progress).toEqual([
      [0, 0, 2],
      [50, 1, 2],
      [100, 2, 2],
    ])
  })

  it('returns missing when performance check capture returns no images', async () => {
    stubFetch(
      vi.fn(async () => {
        return new Response('image', { status: 200 })
      }) as typeof fetch
    )
    const { rootDirectory, vehicleDirectory } = createDirectoryHandle()

    await expect(
      saveTruckToDirectory(rootDirectory, listing, {
        capturePerformanceCheckImages: vi.fn(async () => []),
      })
    ).resolves.toMatchObject({
      performanceCheckImageCount: 0,
      performanceCheckStatus: 'missing',
      sourceUrl: listing.url,
      vehicleImageCount: 2,
      vehicleImageStatus: 'complete',
      vehicleImageTotalCount: 2,
    })
    expect(vehicleDirectory.getDirectoryHandle).not.toHaveBeenCalledWith(
      '성능점검기록부',
      { create: true }
    )
  })

  it('returns missing when listing has no performance check URL', async () => {
    stubFetch(
      vi.fn(async () => {
        return new Response('image', { status: 200 })
      }) as typeof fetch
    )
    const { rootDirectory, vehicleDirectory } = createDirectoryHandle()
    const capturePerformanceCheckImages = vi.fn(async () => [
      new Uint8Array([1]),
    ])

    await expect(
      saveTruckToDirectory(
        rootDirectory,
        { ...listing, performanceCheckUrl: undefined },
        { capturePerformanceCheckImages }
      )
    ).resolves.toMatchObject({
      performanceCheckImageCount: 0,
      performanceCheckStatus: 'missing',
      sourceUrl: listing.url,
      vehicleImageCount: 2,
      vehicleImageStatus: 'complete',
      vehicleImageTotalCount: 2,
    })
    expect(vehicleDirectory.getDirectoryHandle).not.toHaveBeenCalledWith(
      '성능점검기록부',
      { create: true }
    )
    expect(capturePerformanceCheckImages).not.toHaveBeenCalled()
  })

  it('treats performance check capture failure as non-fatal and still writes manuscript', async () => {
    stubFetch(
      vi.fn(async () => {
        return new Response('image', { status: 200 })
      }) as typeof fetch
    )
    const { manuscriptDirectory, rootDirectory, vehicleDirectory, writables } =
      createDirectoryHandle()

    await expect(
      saveTruckToDirectory(rootDirectory, listing, {
        capturePerformanceCheckImages: vi.fn(async () => {
          throw new Error('capture failed')
        }),
      })
    ).resolves.toMatchObject({
      performanceCheckImageCount: 0,
      performanceCheckStatus: 'missing',
      sourceUrl: listing.url,
      vehicleImageCount: 2,
      vehicleImageStatus: 'complete',
      vehicleImageTotalCount: 2,
    })

    expect(manuscriptDirectory.getFileHandle).toHaveBeenCalledWith(
      '차량정보.txt',
      { create: true }
    )
    expect(vehicleDirectory.getDirectoryHandle).not.toHaveBeenCalledWith(
      '성능점검기록부',
      { create: true }
    )
    await expect(
      writables.get('12가_3456/원고/차량정보.txt')!.write
    ).toHaveBeenCalledWith(expect.stringContaining('차량번호 :  12가/3456'))
  })

  it('preserves vehicle image progress semantics', async () => {
    stubFetch(
      vi.fn(async (url: string) => {
        return new Response(`image:${url}`, { status: 200 })
      }) as typeof fetch
    )
    const { rootDirectory } = createDirectoryHandle()
    const progress: Array<[number, number, number]> = []

    await saveTruckToDirectory(rootDirectory, listing, {
      capturePerformanceCheckImages: vi.fn(async () => [new Uint8Array([7])]),
      onProgress: (progressValue, downloaded, total) =>
        progress.push([progressValue, downloaded, total]),
    })
    expect(progress).toEqual([
      [0, 0, 2],
      [50, 1, 2],
      [100, 2, 2],
    ])
  })

  it('reports partial vehicle image results when some image fetches fail', async () => {
    stubFetch(
      vi.fn(async (url: string) => {
        if (url.includes('two.jpg')) {
          return new Response('missing', { status: 404 })
        }

        return new Response(`image:${url}`, { status: 200 })
      }) as typeof fetch
    )
    const { rootDirectory, writables } = createDirectoryHandle()
    const progress: Array<[number, number, number]> = []

    await expect(
      saveTruckToDirectory(rootDirectory, listing, {
        capturePerformanceCheckImages: vi.fn(async () => []),
        onProgress: (progressValue, downloaded, total) =>
          progress.push([progressValue, downloaded, total]),
      })
    ).resolves.toMatchObject({
      sourceUrl: listing.url,
      vehicleImageCount: 1,
      vehicleImageStatus: 'partial',
      vehicleImageTotalCount: 2,
    })

    expect(writables.has('12가_3456/차량 이미지/사진_1.jpg')).toBe(true)
    expect(writables.has('12가_3456/차량 이미지/사진_2.jpg')).toBe(false)
    expect(progress).toEqual([
      [0, 0, 2],
      [50, 1, 2],
    ])
  })

  it('creates structured subfolders before writing files', async () => {
    stubFetch(
      vi.fn(async (url: string) => {
        return new Response(`image:${url}`, { status: 200 })
      }) as typeof fetch
    )
    const { rootDirectory, vehicleDirectory } = createDirectoryHandle()

    await saveTruckToDirectory(rootDirectory, listing, {
      capturePerformanceCheckImages: vi.fn(async () => [new Uint8Array([7])]),
    })

    expect(
      vehicleDirectory.getDirectoryHandle.mock.calls.map(([name]) => name)
    ).toEqual(['차량 이미지', '원고', '성능점검기록부'])
  })

  it('does not create a vehicle folder when already aborted', async () => {
    const { rootDirectory } = createDirectoryHandle()
    const controller = new AbortController()
    controller.abort()

    await expect(
      saveTruckToDirectory(rootDirectory, listing, {
        signal: controller.signal,
      })
    ).rejects.toThrow('다운로드가 취소되었습니다.')
    expect(rootDirectory.getDirectoryHandle).not.toHaveBeenCalled()
  })

  it('rejects AbortError from image fetch without writing final text', async () => {
    const controller = new AbortController()
    const singleImageListing = {
      ...listing,
      images: ['https://img.example.com/one.jpg'],
    }
    stubFetch(
      vi.fn(async () => {
        throw new DOMException('다운로드가 취소되었습니다.', 'AbortError')
      }) as typeof fetch
    )
    const { manuscriptDirectory, rootDirectory } = createDirectoryHandle()
    const progress: Array<[number, number, number]> = []

    const savePromise = saveTruckToDirectory(
      rootDirectory,
      singleImageListing,
      {
        signal: controller.signal,
        onProgress: (progressValue, downloaded, total) =>
          progress.push([progressValue, downloaded, total]),
      }
    )

    await expect(savePromise).rejects.toThrow('다운로드가 취소되었습니다.')
    expect(manuscriptDirectory.getFileHandle).not.toHaveBeenCalledWith(
      '차량정보.txt',
      { create: true }
    )
    expect(progress).toEqual([[0, 0, 1]])
  })
})
