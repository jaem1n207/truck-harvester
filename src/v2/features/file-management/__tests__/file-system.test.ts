import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import {
  isFileSystemAccessAvailable,
  saveTruckToDirectory,
  type WritableDirectoryHandle,
} from '../file-system'

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

function createWritable() {
  return {
    write: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  }
}

function createDirectoryHandle() {
  const writables = new Map<string, ReturnType<typeof createWritable>>()
  const getFileHandle = vi.fn(async (name: string) => {
    const writable = createWritable()
    writables.set(name, writable)
    return {
      createWritable: vi.fn(async () => writable),
    }
  })
  const vehicleDirectory = {
    getFileHandle,
  }
  const rootDirectory = {
    getDirectoryHandle: vi.fn(async () => vehicleDirectory),
  }

  return {
    rootDirectory: rootDirectory as unknown as WritableDirectoryHandle,
    vehicleDirectory,
    writables,
  }
}

describe('v2 file-system', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('detects File System Access API support', () => {
    vi.stubGlobal('window', { showDirectoryPicker: vi.fn() })
    expect(isFileSystemAccessAvailable()).toBe(true)

    vi.stubGlobal('window', {})
    expect(isFileSystemAccessAvailable()).toBe(false)
  })

  it('saves text and raw image files into a vehicle folder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        return new Response(`image:${url}`, { status: 200 })
      })
    )
    const { rootDirectory, vehicleDirectory, writables } =
      createDirectoryHandle()
    const progress: Array<[number, number, number]> = []

    await saveTruckToDirectory(rootDirectory, listing, {
      onProgress: (progressValue, downloaded, total) =>
        progress.push([progressValue, downloaded, total]),
    })

    expect(rootDirectory.getDirectoryHandle).toHaveBeenCalledWith('12가_3456', {
      create: true,
    })
    expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith(
      '12가_3456 원고.txt',
      { create: true }
    )
    expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith('K-001.jpg', {
      create: true,
    })
    expect(vehicleDirectory.getFileHandle).toHaveBeenCalledWith('K-002.jpg', {
      create: true,
    })

    await expect(
      writables.get('12가_3456 원고.txt')!.write
    ).toHaveBeenCalledWith(expect.stringContaining('차량번호 :  12가/3456'))
    await expect(writables.get('K-001.jpg')!.write).toHaveBeenCalledWith(
      new Uint8Array(
        await new Response(
          'image:https://img.example.com/one.jpg'
        ).arrayBuffer()
      )
    )
    expect(progress).toEqual([
      [0, 0, 2],
      [50, 1, 2],
      [100, 2, 2],
    ])
  })

  it('writes the text file after image files so modified-date sorting keeps it at the edge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        return new Response(`image:${url}`, { status: 200 })
      })
    )
    const { rootDirectory, vehicleDirectory } = createDirectoryHandle()

    await saveTruckToDirectory(rootDirectory, listing)

    expect(
      vehicleDirectory.getFileHandle.mock.calls.map(([name]) => name)
    ).toEqual(['K-001.jpg', 'K-002.jpg', '12가_3456 원고.txt'])
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
})
