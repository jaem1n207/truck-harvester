import { describe, it, expect } from 'vitest'
import { validateUrl, validateUrlsFromText, getValidUrls } from '../url-validator'

describe('url-validator', () => {
  describe('validateUrl', () => {
    it('유효한 HTTP URL을 인식한다', () => {
      expect(validateUrl('http://example.com')).toBe(true)
      expect(validateUrl('http://example.com/path')).toBe(true)
    })
    
    it('유효한 HTTPS URL을 인식한다', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('https://example.com/path?query=1')).toBe(true)
    })
    
    it('잘못된 URL을 거부한다', () => {
      expect(validateUrl('not-a-url')).toBe(false)
      expect(validateUrl('ftp://example.com')).toBe(false)
      expect(validateUrl('')).toBe(false)
      expect(validateUrl('javascript:alert(1)')).toBe(false)
    })
  })
  
  describe('validateUrlsFromText', () => {
    it('멀티라인 텍스트에서 URL을 검증한다', () => {
      const text = `https://example.com/1
https://example.com/2
invalid-url
https://example.com/3`
      
      const results = validateUrlsFromText(text)
      
      expect(results).toHaveLength(4)
      expect(results[0]).toEqual({
        url: 'https://example.com/1',
        isValid: true,
        isDuplicate: false,
        error: undefined
      })
      expect(results[2]).toEqual({
        url: 'invalid-url',
        isValid: false,
        isDuplicate: false,
        error: '유효하지 않은 URL 형식입니다.'
      })
    })
    
    it('중복된 URL을 감지한다', () => {
      const text = `https://example.com/1
https://EXAMPLE.COM/1
https://example.com/2`
      
      const results = validateUrlsFromText(text)
      
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({
        url: 'https://example.com/1',
        isValid: true,
        isDuplicate: false,
        error: undefined
      })
      expect(results[1]).toEqual({
        url: 'https://EXAMPLE.COM/1',
        isValid: true,
        isDuplicate: true,
        error: '중복된 URL입니다.'
      })
    })
    
    it('빈 라인을 무시한다', () => {
      const text = `https://example.com/1

https://example.com/2
`
      
      const results = validateUrlsFromText(text)
      
      expect(results).toHaveLength(2)
      expect(results.every(r => r.url.trim().length > 0)).toBe(true)
    })
  })
  
  describe('getValidUrls', () => {
    it('유효하고 중복되지 않은 URL만 반환한다', () => {
      const urlResults = [
        { url: 'https://example.com/1', isValid: true, isDuplicate: false },
        { url: 'invalid-url', isValid: false, isDuplicate: false },
        { url: 'https://example.com/1', isValid: true, isDuplicate: true },
        { url: 'https://example.com/2', isValid: true, isDuplicate: false },
      ]
      
      const validUrls = getValidUrls(urlResults)
      
      expect(validUrls).toEqual([
        'https://example.com/1',
        'https://example.com/2'
      ])
    })
    
    it('모든 URL이 무효한 경우 빈 배열을 반환한다', () => {
      const urlResults = [
        { url: 'invalid-url', isValid: false, isDuplicate: false },
        { url: 'another-invalid', isValid: false, isDuplicate: false },
      ]
      
      const validUrls = getValidUrls(urlResults)
      
      expect(validUrls).toEqual([])
    })
  })
})