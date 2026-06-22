import { describe, expect, it } from 'vitest'

import {
  buildImageFileName,
  buildManuscriptFileName,
  buildManuscriptFolderName,
  buildPerformanceCheckFolderName,
  buildPerformanceCheckImageFileName,
  buildTextFileName,
  buildTruckFolderName,
  buildVehicleImageFileName,
  buildVehicleImagesFolderName,
} from '../filename'

describe('file-management filename builders', () => {
  it('builds the save structure folder names', () => {
    expect(buildVehicleImagesFolderName()).toBe('차량 이미지')
    expect(buildPerformanceCheckFolderName()).toBe('성능점검기록부')
    expect(buildManuscriptFolderName()).toBe('원고')
  })

  it('builds the save structure file names', () => {
    expect(buildVehicleImageFileName(0)).toBe('사진_1.jpg')
    expect(buildVehicleImageFileName(8)).toBe('사진_9.jpg')
    expect(buildPerformanceCheckImageFileName(0)).toBe('성능점검기록부_1.jpg')
    expect(buildPerformanceCheckImageFileName(2)).toBe('성능점검기록부_3.jpg')
    expect(buildManuscriptFileName()).toBe('차량정보.txt')
  })

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

  it('sanitizes Windows-reserved filename characters in vehicle folder names', () => {
    expect(buildTruckFolderName('12가<34>56:"/\\|?*')).toBe('12가_34_56_______')
  })
})
