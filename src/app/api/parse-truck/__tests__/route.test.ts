import { describe, it, expect, vi } from 'vitest'

// Cheerio 파싱 로직을 테스트하기 위한 Mock HTML 데이터
const mockHtmlSuccess = `
<!DOCTYPE html>
<html>
<head><title>중고 트럭 - 12가3456</title></head>
<body>
  <h1>2020년 현대 마이티 12가3456</h1>
  <p class="vcash">가격: <span class="red">2,500</span>만원</p>
  <div class="vehicle-number">12가3456</div>
  <div class="first-registration">2020.03.15</div>
  <div class="mileage">150,000km</div>
  <div onmouseover="changeImg('truck1_FULL.jpg')"></div>
  <div onmouseover="changeImg('truck2_FULL.jpg')"></div>
  <img src="truck3_FULL.jpg" />
</body>
</html>
`

const mockHtmlMinimal = `
<!DOCTYPE html>
<html>
<body>
  <p class="vcash"><span class="red">1,000</span></p>
</body>
</html>
`

describe('parse-truck API', () => {
  describe('HTML 파싱 로직', () => {
    it('완전한 트럭 정보를 올바르게 파싱한다', async () => {
      // 이 테스트는 실제 파싱 함수를 별도로 추출해야 완전히 테스트할 수 있습니다.
      // 현재는 파싱 규칙의 유효성만 검증합니다.
      
      const cheerio = await import('cheerio')
      const $ = cheerio.load(mockHtmlSuccess)
      
      // 가격 파싱 테스트
      const priceText = $('p.vcash > span.red').first().text().trim()
      const priceRaw = parseInt(priceText.replace(/[,\s]/g, '')) || 0
      expect(priceRaw).toBe(2500)
      
      // 차량번호 파싱 테스트 (fallback 포함)
      const vehicleNumber = (
        $('.vehicle-number').text().trim() ||
        $('.car-number').text().trim() ||
        $('[class*="number"]').first().text().trim() ||
        'Unknown'
      )
      expect(vehicleNumber).toBe('12가3456')
      
      // 이미지 파싱 테스트
      const images: string[] = []
      $('*[onmouseover*="changeImg"]').each((_, element) => {
        const onmouseover = $(element).attr('onmouseover')
        if (onmouseover) {
          const match = onmouseover.match(/changeImg\(['"](.*?)['"]\)/)
          if (match && match[1]) {
            const imageName = match[1]
            if (imageName.includes('FULL.jpg') && 
                !imageName.includes('_TH') && 
                !imageName.toLowerCase().includes('blank')) {
              images.push(imageName)
            }
          }
        }
      })
      
      expect(images).toContain('truck1_FULL.jpg')
      expect(images).toContain('truck2_FULL.jpg')
    })
    
    it('최소한의 정보만 있어도 파싱한다', async () => {
      const cheerio = await import('cheerio')
      const $ = cheerio.load(mockHtmlMinimal)
      
      const priceText = $('p.vcash > span.red').first().text().trim()
      const priceRaw = parseInt(priceText.replace(/[,\s]/g, '')) || 0
      expect(priceRaw).toBe(1000)
      
      // fallback이 작동하는지 확인
      const vehicleNumber = (
        $('.vehicle-number').text().trim() ||
        $('.car-number').text().trim() ||
        $('[class*="number"]').first().text().trim() ||
        'Unknown'
      )
      expect(vehicleNumber).toBe('Unknown')
    })
  })
  
  describe('URL 유효성 검사', () => {
    it('유효한 요청 데이터를 검증한다', async () => {
      const { z } = await import('zod')
      
      const parseRequestSchema = z.object({
        urls: z.array(z.string().url()).min(1),
        rateLimitMs: z.number().min(100).default(1000),
        timeoutMs: z.number().min(1000).default(10000),
      })
      
      const validData = {
        urls: ['https://example.com/truck/1', 'https://example.com/truck/2'],
        rateLimitMs: 1000,
        timeoutMs: 10000,
      }
      
      const result = parseRequestSchema.parse(validData)
      expect(result.urls).toHaveLength(2)
      expect(result.rateLimitMs).toBe(1000)
      expect(result.timeoutMs).toBe(10000)
    })
    
    it('잘못된 요청 데이터를 거부한다', async () => {
      const { z } = await import('zod')
      
      const parseRequestSchema = z.object({
        urls: z.array(z.string().url()).min(1),
        rateLimitMs: z.number().min(100).default(1000),
        timeoutMs: z.number().min(1000).default(10000),
      })
      
      const invalidData = {
        urls: ['not-a-url'],
        rateLimitMs: 50, // too low
        timeoutMs: 500, // too low
      }
      
      expect(() => parseRequestSchema.parse(invalidData)).toThrow()
    })
  })
})