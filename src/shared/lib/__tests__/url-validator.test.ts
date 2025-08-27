import { describe, it, expect } from 'vitest'
import { validateUrl, validateUrlsFromText, getValidUrls } from '../url-validator'

describe('url-validator', () => {
  describe('validateUrl', () => {
    it('허용된 도메인의 유효한 URL을 인식한다', () => {
      const validUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789'
      const result = validateUrl(validUrl)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })
    
    it('허용되지 않은 도메인을 거부한다', () => {
      const result = validateUrl('https://example.com/model/DetailView.asp?ShopNo=123&MemberNo=456&OnCarNo=789')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('허용되지 않은 도메인입니다')
    })
    
    it('허용되지 않은 경로를 거부한다', () => {
      const result = validateUrl('https://www.truck-no1.co.kr/invalid/path')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('허용되지 않은 경로입니다')
    })
    
    it('필수 파라미터가 누락된 URL을 거부한다', () => {
      const resultMissingShopNo = validateUrl('https://www.truck-no1.co.kr/model/DetailView.asp?MemberNo=67890&OnCarNo=2025123456789')
      expect(resultMissingShopNo.isValid).toBe(false)
      expect(resultMissingShopNo.error).toContain('필수 파라미터가 누락되었습니다: ShopNo')
      
      const resultMissingMemberNo = validateUrl('https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&OnCarNo=2025123456789')
      expect(resultMissingMemberNo.isValid).toBe(false)
      expect(resultMissingMemberNo.error).toContain('필수 파라미터가 누락되었습니다: MemberNo')
      
      const resultMissingOnCarNo = validateUrl('https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890')
      expect(resultMissingOnCarNo.isValid).toBe(false)
      expect(resultMissingOnCarNo.error).toContain('필수 파라미터가 누락되었습니다: OnCarNo')
    })
    
    it('잘못된 프로토콜을 거부한다', () => {
      const result = validateUrl('ftp://www.truck-no1.co.kr/model/DetailView.asp')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('HTTP 또는 HTTPS 프로토콜만 허용됩니다')
    })
    
    it('잘못된 URL 형식을 거부한다', () => {
      const result = validateUrl('not-a-url')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('유효하지 않은 URL 형식입니다.')
    })
  })
  
  describe('validateUrlsFromText', () => {
    it('멀티라인 텍스트에서 URL을 검증한다', () => {
      const text = `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789
https://example.com/invalid
invalid-url
https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321`
      
      const results = validateUrlsFromText(text)
      
      expect(results).toHaveLength(4)
      expect(results[0]).toEqual({
        url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789',
        isValid: true,
        isDuplicate: false,
        error: undefined
      })
      expect(results[1]).toEqual({
        url: 'https://example.com/invalid',
        isValid: false,
        isDuplicate: false,
        error: '허용되지 않은 도메인입니다. 허용된 도메인: www.truck-no1.co.kr'
      })
      expect(results[2]).toEqual({
        url: 'invalid-url',
        isValid: false,
        isDuplicate: false,
        error: '유효하지 않은 URL 형식입니다.'
      })
    })
    
    it('중복된 URL을 감지한다', () => {
      const text = `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789
https://WWW.TRUCK-NO1.CO.KR/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789
https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321`
      
      const results = validateUrlsFromText(text)
      
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({
        url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789',
        isValid: true,
        isDuplicate: false,
        error: undefined
      })
      expect(results[1]).toEqual({
        url: 'https://WWW.TRUCK-NO1.CO.KR/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789',
        isValid: true,
        isDuplicate: true,
        error: '중복된 URL입니다.'
      })
    })
    
    it('빈 라인을 무시한다', () => {
      const text = `https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789

https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321
`
      
      const results = validateUrlsFromText(text)
      
      expect(results).toHaveLength(2)
      expect(results.every(r => r.url.trim().length > 0)).toBe(true)
    })
  })
  
  describe('getValidUrls', () => {
    it('유효하고 중복되지 않은 URL만 반환한다', () => {
      const urlResults = [
        { url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789', isValid: true, isDuplicate: false },
        { url: 'invalid-url', isValid: false, isDuplicate: false },
        { url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789', isValid: true, isDuplicate: true },
        { url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321', isValid: true, isDuplicate: false },
      ]
      
      const validUrls = getValidUrls(urlResults)
      
      expect(validUrls).toEqual([
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789',
        'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321'
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