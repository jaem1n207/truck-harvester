import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import {
  createTruckZipArchive,
  createTruckZipBlob,
  downloadTruckZip,
} from '../zip-fallback'

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
  smartStoreTable: {
    vehicleName: '2020년 현대 마이티',
    registrationLabel: '2020년 6월 등록',
    mileage: '150,000km',
    vehicleNumber: '12가/3456',
    upperInfo: '냉동탑',
    lowerInfo: '후방카메라',
    hasVehicleInfo: true,
  },
  images: [
    'https://img.example.com/one.jpg',
    'https://img.example.com/two.jpg',
  ],
}

describe('createTruckZipBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates an archive with structured folders and save results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        return new Response(`image:${url}`, { status: 200 })
      })
    )

    const { blob, results } = await createTruckZipArchive([listing], {
      capturePerformanceCheckImages: vi.fn(async () => [
        new Uint8Array([7, 8]),
        new Uint8Array([9, 10]),
      ]),
    })
    const zip = await JSZip.loadAsync(blob)

    expect(zip.file('12가_3456/원고/12가_3456 원고.txt')).toBeTruthy()
    expect(zip.file('12가_3456/차량 이미지/K-001.jpg')).toBeTruthy()
    expect(zip.file('12가_3456/차량 이미지/K-002.jpg')).toBeTruthy()
    expect(zip.files['12가_3456/성능점검기록부/']?.dir).toBe(true)
    expect(
      zip.file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_1.jpg')
    ).toBeTruthy()
    expect(
      zip.file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_2.jpg')
    ).toBeTruthy()
    expect(results).toEqual([
      {
        performanceCheckImageCount: 2,
        performanceCheckStatus: 'saved',
        sourceUrl: listing.url,
        vehicleImageCount: 2,
        vehicleImageStatus: 'complete',
        vehicleImageTotalCount: 2,
        vehicleFolderName: '12가_3456',
        vehicleNumber: '12가/3456',
      },
    ])

    await expect(
      zip.file('12가_3456/원고/12가_3456 원고.txt')!.async('string')
    ).resolves.toContain('차량번호 :  12가/3456')
    await expect(zip.file('12가_3456/원고/12가_3456 원고.txt')!.async('string'))
      .resolves.toContain(`기타사항 :
  차명 : 2020년 현대 마이티
  연식 : 2020년 6월 등록
  주행거리 : 150,000km
  차량번호 : 12가/3456
  차량정보 :
    상부 : 냉동탑
    하부 : 후방카메라`)
    await expect(
      zip.file('12가_3456/원고/12가_3456 원고.txt')!.async('string')
    ).resolves.toContain('#사진:K-001.jpg')
    await expect(
      zip.file('12가_3456/원고/12가_3456 원고.txt')!.async('string')
    ).resolves.not.toContain('#사진:사진_1.jpg')
    await expect(
      zip.file('12가_3456/차량 이미지/K-001.jpg')!.async('string')
    ).resolves.toBe('image:https://img.example.com/one.jpg')
    await expect(
      zip
        .file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_1.jpg')!
        .async('uint8array')
    ).resolves.toEqual(new Uint8Array([7, 8]))
    await expect(
      zip
        .file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_2.jpg')!
        .async('uint8array')
    ).resolves.toEqual(new Uint8Array([9, 10]))
  })

  it('keeps createTruckZipBlob as a blob-only compatibility wrapper', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image-bytes', { status: 200 }))
    )

    await expect(
      createTruckZipBlob([listing], {
        capturePerformanceCheckImages: vi.fn(async () => []),
      })
    ).resolves.toBeInstanceOf(Blob)
  })

  it('reports missing when performance check capture fails without failing the archive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image-bytes', { status: 200 }))
    )

    const { blob, results } = await createTruckZipArchive([listing], {
      capturePerformanceCheckImages: vi.fn(async () => {
        throw new Error('capture failed')
      }),
    })
    const zip = await JSZip.loadAsync(blob)

    expect(zip.file('12가_3456/원고/12가_3456 원고.txt')).toBeTruthy()
    expect(zip.files['12가_3456/성능점검기록부/']).toBeUndefined()
    expect(
      zip.file('12가_3456/성능점검기록부/12가_3456_성능점검기록부_1.jpg')
    ).toBeNull()
    expect(results).toEqual([
      {
        performanceCheckImageCount: 0,
        performanceCheckStatus: 'missing',
        sourceUrl: listing.url,
        vehicleImageCount: 2,
        vehicleImageStatus: 'complete',
        vehicleImageTotalCount: 2,
        vehicleFolderName: '12가_3456',
        vehicleNumber: '12가/3456',
      },
    ])
  })

  it('reports missing when a listing has no performance check URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image-bytes', { status: 200 }))
    )
    const capturePerformanceCheckImages = vi.fn(async () => [
      new Uint8Array([1]),
    ])

    const { blob, results } = await createTruckZipArchive(
      [{ ...listing, performanceCheckUrl: undefined }],
      { capturePerformanceCheckImages }
    )
    const zip = await JSZip.loadAsync(blob)

    expect(results).toEqual([
      {
        performanceCheckImageCount: 0,
        performanceCheckStatus: 'missing',
        sourceUrl: listing.url,
        vehicleImageCount: 2,
        vehicleImageStatus: 'complete',
        vehicleImageTotalCount: 2,
        vehicleFolderName: '12가_3456',
        vehicleNumber: '12가/3456',
      },
    ])
    expect(zip.files['12가_3456/성능점검기록부/']).toBeUndefined()
    expect(capturePerformanceCheckImages).not.toHaveBeenCalled()
  })

  it('reports progress after each truck is added', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image-bytes', { status: 200 }))
    )
    const progress: number[] = []

    await createTruckZipBlob(
      [
        listing,
        { ...listing, performanceCheckUrl: undefined, vnumber: '99다9999' },
      ],
      {
        capturePerformanceCheckImages: vi.fn(async () => []),
        onProgress: (value) => progress.push(value),
      }
    )

    expect(progress).toEqual([50, 100])
  })

  it('reports partial vehicle image results when an image fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('two.jpg')) {
          return new Response('missing', { status: 404 })
        }

        return new Response(`image:${url}`, { status: 200 })
      })
    )

    const { blob, results } = await createTruckZipArchive([listing], {
      capturePerformanceCheckImages: vi.fn(async () => []),
    })
    const zip = await JSZip.loadAsync(blob)

    expect(results).toEqual([
      {
        performanceCheckImageCount: 0,
        performanceCheckStatus: 'missing',
        sourceUrl: listing.url,
        vehicleImageCount: 1,
        vehicleImageStatus: 'partial',
        vehicleImageTotalCount: 2,
        vehicleFolderName: '12가_3456',
        vehicleNumber: '12가/3456',
      },
    ])
    expect(zip.file('12가_3456/차량 이미지/K-001.jpg')).toBeTruthy()
    expect(zip.file('12가_3456/차량 이미지/K-002.jpg')).toBeNull()
  })

  it('rejects abort during image fetch without reporting truck progress', async () => {
    const controller = new AbortController()
    const progress: number[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(
                new DOMException('다운로드가 취소되었습니다.', 'AbortError')
              )
            })
          })
      )
    )

    const zipPromise = createTruckZipBlob(
      [{ ...listing, images: ['https://img.example.com/one.jpg'] }],
      {
        signal: controller.signal,
        onProgress: (value) => progress.push(value),
      }
    )

    controller.abort()

    await expect(zipPromise).rejects.toThrow('다운로드가 취소되었습니다.')
    expect(progress).toEqual([])
  })

  it('does not create a download link when aborted after zip generation', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image-bytes', { status: 200 }))
    )
    vi.spyOn(JSZip.prototype, 'generateAsync').mockImplementation(async () => {
      controller.abort()
      return new Blob(['zip-bytes'])
    })
    const click = vi.fn()
    const anchor = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor)
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node)
    const removeChild = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:v2-zip'),
      revokeObjectURL: vi.fn(),
    })

    await expect(
      downloadTruckZip([listing], {
        capturePerformanceCheckImages: vi.fn(async () => []),
        signal: controller.signal,
      })
    ).rejects.toThrow('다운로드가 취소되었습니다.')

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(createElement).not.toHaveBeenCalled()
    expect(appendChild).not.toHaveBeenCalled()
    expect(removeChild).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
  })

  it('downloads the generated zip with a stable Korean filename', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image-bytes', { status: 200 }))
    )
    const click = vi.fn()
    const anchor = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor)
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node)
    const removeChild = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:v2-zip'),
      revokeObjectURL: vi.fn(),
    })

    const results = await downloadTruckZip([listing], {
      capturePerformanceCheckImages: vi.fn(async () => [
        new Uint8Array([7, 8]),
      ]),
      date: new Date('2026-04-26T00:00:00Z'),
    })

    expect(results).toEqual([
      {
        performanceCheckImageCount: 1,
        performanceCheckStatus: 'saved',
        sourceUrl: listing.url,
        vehicleImageCount: 2,
        vehicleImageStatus: 'complete',
        vehicleImageTotalCount: 2,
        vehicleFolderName: '12가_3456',
        vehicleNumber: '12가/3456',
      },
    ])

    expect(createElement).toHaveBeenCalledWith('a')
    expect(anchor.href).toBe('blob:v2-zip')
    expect(anchor.download).toBe('truck-data-2026-04-26.zip')
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:v2-zip')
  })
})
