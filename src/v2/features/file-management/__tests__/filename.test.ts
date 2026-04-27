import { describe, expect, it } from 'vitest'

import {
  buildImageFileName,
  buildTextFileName,
  buildTruckFolderName,
} from '../filename'

describe('file-management filename builders', () => {
  it('builds legacy-compatible image file names', () => {
    expect(buildImageFileName(0)).toBe('K-001.jpg')
    expect(buildImageFileName(8)).toBe('K-009.jpg')
    expect(buildImageFileName(99)).toBe('K-100.jpg')
  })

  it('sanitizes vehicle numbers for folder and text file names', () => {
    expect(buildTruckFolderName('12가/3456:*?')).toBe('12가_3456___')
    expect(buildTextFileName('12가/3456:*?')).toBe('12가_3456___ 원고.txt')
  })

  it('uses a readable fallback when vehicle number is blank', () => {
    expect(buildTruckFolderName('   ')).toBe('차량번호_없음')
    expect(buildTextFileName('   ')).toBe('차량번호_없음 원고.txt')
  })
})
