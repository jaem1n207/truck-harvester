import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isFileSystemAccessSupported } from '../file-system'

// Mock window object
const mockWindow = vi.fn(() => ({
  showDirectoryPicker: vi.fn()
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('file-system', () => {
  describe('isFileSystemAccessSupported', () => {
    it('File System Access API가 지원되는 환경에서 true를 반환한다', () => {
      Object.defineProperty(global, 'window', {
        value: {
          showDirectoryPicker: vi.fn()
        },
        writable: true
      })
      
      expect(isFileSystemAccessSupported()).toBe(true)
    })
    
    it('File System Access API가 지원되지 않는 환경에서 false를 반환한다', () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      })
      
      expect(isFileSystemAccessSupported()).toBe(false)
    })
    
    it('window가 없는 환경(SSR)에서 false를 반환한다', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true
      })
      
      expect(isFileSystemAccessSupported()).toBe(false)
    })
  })
  
  // 추가 테스트는 실제 File System Access API 호출을 모킹해야 하므로 복잡합니다.
  // 여기서는 핵심 유틸리티 함수만 테스트합니다.
})