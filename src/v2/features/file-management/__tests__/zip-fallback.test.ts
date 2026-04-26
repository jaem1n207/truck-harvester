import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { createTruckZipBlob, downloadTruckZip } from '../zip-fallback'

const listing: TruckListing = {
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
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

describe('createTruckZipBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates a vehicle folder with text and raw image files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        return new Response(`image:${url}`, { status: 200 })
      })
    )

    const zipBlob = await createTruckZipBlob([listing])
    const zip = await JSZip.loadAsync(zipBlob)

    expect(zip.file('12가_3456/12가_3456 원고.txt')).toBeTruthy()
    expect(zip.file('12가_3456/K-001.jpg')).toBeTruthy()
    expect(zip.file('12가_3456/K-002.jpg')).toBeTruthy()

    await expect(
      zip.file('12가_3456/12가_3456 원고.txt')!.async('string')
    ).resolves.toContain('차량번호 :  12가/3456')
    await expect(
      zip.file('12가_3456/K-001.jpg')!.async('string')
    ).resolves.toBe('image:https://img.example.com/one.jpg')
  })

  it('reports progress after each truck is added', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image-bytes', { status: 200 }))
    )
    const progress: number[] = []

    await createTruckZipBlob([listing, { ...listing, vnumber: '99다9999' }], {
      onProgress: (value) => progress.push(value),
    })

    expect(progress).toEqual([50, 100])
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

    await downloadTruckZip([listing], {
      date: new Date('2026-04-26T00:00:00Z'),
    })

    expect(createElement).toHaveBeenCalledWith('a')
    expect(anchor.href).toBe('blob:v2-zip')
    expect(anchor.download).toBe('truck-data-2026-04-26.zip')
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:v2-zip')
  })
})
