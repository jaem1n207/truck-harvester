import { describe, it, expect } from 'vitest'

// Cheerio 파싱 로직을 테스트하기 위한 Mock HTML 데이터 (새로운 구조)
const mockHtmlSuccess = `
<!DOCTYPE html>
<html>
<head><title>중고 트럭 - 12가3456</title></head>
<body>
  <h1>2020년 현대 마이티 12가3456</h1>
  <p class="vname">현대 마이티</p>
  <p class="vnumber">12가3456</p>
  <p class="vcash">가격: <span class="red">3,550</span>만원</p>
  <div class="car-detail">
    <span>연식: <strong class="number">2020년</strong></span>
    <span>주행거리: <strong class="number">150,000km</strong></span>
  </div>
  <div class="vcontent">에어컨,파워스티어링,ABS,에어백,전동미러</div>
  <div class="sumnail">
    <ul>
      <li><img onmouseover="changeImg('https://example.com/truck1.jpg')" src="https://example.com/truck1_TH.jpg" /></li>
      <li><img onmouseover="changeImg('https://example.com/truck2.jpg')" src="https://example.com/truck2_TH.jpg" /></li>
    </ul>
    <img src="https://example.com/truck3.jpg" />
  </div>
</body>
</html>
`

const mockHtmlMinimal = `
<!DOCTYPE html>
<html>
<body>
  <p class="vname">차량명 없음</p>
  <p class="vnumber">번호 없음</p>
  <p class="vcash"><span class="red">1,000</span></p>
  <div class="vcontent">정보 없음</div>
</body>
</html>
`

describe('parse-truck API', () => {
  describe('HTML 파싱 로직', () => {
    it('완전한 트럭 정보를 올바르게 파싱한다', async () => {
      // 새로운 파싱 로직을 테스트합니다.

      const cheerio = await import('cheerio')
      const $ = cheerio.load(mockHtmlSuccess)

      // 차명 파싱 테스트 (p.vname)
      const vname = $('p.vname').text().trim() || '차명 정보 없음'
      expect(vname).toBe('현대 마이티')

      // 차량번호 파싱 테스트 (p.vnumber)
      const vnumber = $('p.vnumber').text().trim() || '차량번호 정보 없음'
      expect(vnumber).toBe('12가3456')

      // 가격 파싱 테스트
      const priceText = $('p.vcash > span.red').first().text().trim()
      const priceRaw = parseInt(priceText.replace(/[,\s]/g, '')) || 0
      const priceRawWon = priceRaw * 10000
      expect(priceRaw).toBe(3550)
      expect(priceRawWon).toBe(35500000)

      // 축약형 라벨 테스트 (3,550만원 = 3.6천만)
      let compactLabel = ''
      if (priceRaw >= 10000) {
        const billions = Math.floor(priceRaw / 10000)
        const remainder = priceRaw % 10000
        if (remainder === 0) {
          compactLabel = `${billions}억`
        } else {
          const thousands = Math.round(remainder / 1000)
          if (thousands === 0) {
            compactLabel = `${billions}억`
          } else {
            compactLabel = `${billions}.${thousands}억`
          }
        }
      } else if (priceRaw >= 1000) {
        const thousands = Math.floor(priceRaw / 1000)
        const hundreds = Math.round((priceRaw % 1000) / 100)
        if (hundreds === 0) {
          compactLabel = `${thousands}천만`
        } else {
          compactLabel = `${thousands}.${hundreds}천만`
        }
      } else {
        compactLabel = `${priceRaw.toLocaleString()}만원`
      }
      expect(compactLabel).toBe('3.6천만')

      // 연식과 주행거리 파싱 테스트 (.car-detail strong.number)
      const carDetailNumbers = $('.car-detail strong.number')
      let year = '연식 정보 없음'
      let mileage = '주행거리 정보 없음'

      carDetailNumbers.each((index, element) => {
        const text = $(element).text().trim()
        if (text.includes('년') && year === '연식 정보 없음') {
          year = text
        } else if (text.includes('km') && mileage === '주행거리 정보 없음') {
          mileage = text
        }
      })
      expect(year).toBe('2020년')
      expect(mileage).toBe('150,000km')

      // 옵션 파싱 테스트 (.vcontent, 콤마를 /로 변환)
      const rawOptions = $('.vcontent').text().trim() || '기타사항 정보 없음'
      const options =
        rawOptions !== '기타사항 정보 없음'
          ? rawOptions.replace(/,/g, '/')
          : rawOptions
      expect(options).toBe('에어컨/파워스티어링/ABS/에어백/전동미러')

      // 이미지 파싱 테스트 (.sumnail ul li img[onmouseover*="changeImg"])
      const images: string[] = []
      $('.sumnail ul li img[onmouseover*="changeImg"]').each((_, element) => {
        const onmouseover = $(element).attr('onmouseover')
        if (onmouseover) {
          const match = onmouseover.match(/changeImg\(['"](.*?)['"]/)
          if (match && match[1]) {
            const imageUrl = match[1]
            // 전체 URL이므로 직접 사용 (Blank 이미지만 제외)
            if (!imageUrl.toLowerCase().includes('blank')) {
              images.push(imageUrl)
            }
          }
        }
      })

      // .sumnail img src fallback 테스트 - _TH가 없는 이미지만
      $('.sumnail img').each((_, element) => {
        const src = $(element).attr('src')
        if (
          src &&
          !src.includes('_TH') &&
          !src.toLowerCase().includes('blank')
        ) {
          images.push(src)
        }
      })

      expect(images).toContain('https://example.com/truck1.jpg')
      expect(images).toContain('https://example.com/truck2.jpg')
      expect(images).toContain('https://example.com/truck3.jpg')
    })

    it('최소한의 정보만 있어도 파싱한다', async () => {
      const cheerio = await import('cheerio')
      const $ = cheerio.load(mockHtmlMinimal)

      // 새로운 필드들의 기본값 테스트
      const vname = $('p.vname').text().trim() || '차명 정보 없음'
      const vnumber = $('p.vnumber').text().trim() || '차량번호 정보 없음'
      expect(vname).toBe('차량명 없음')
      expect(vnumber).toBe('번호 없음')

      const priceText = $('p.vcash > span.red').first().text().trim()
      const priceRaw = parseInt(priceText.replace(/[,\s]/g, '')) || 0
      expect(priceRaw).toBe(1000)

      // 연식과 주행거리가 없을 때 기본값 확인
      const carDetailNumbers = $('.car-detail strong.number')
      let year = '연식 정보 없음'
      let mileage = '주행거리 정보 없음'

      carDetailNumbers.each((index, element) => {
        const text = $(element).text().trim()
        if (text.includes('년') && year === '연식 정보 없음') {
          year = text
        } else if (text.includes('km') && mileage === '주행거리 정보 없음') {
          mileage = text
        }
      })
      expect(year).toBe('연식 정보 없음')
      expect(mileage).toBe('주행거리 정보 없음')

      // 옵션 정보 확인
      const options = $('.vcontent').text().trim() || '기타사항 정보 없음'
      expect(options).toBe('정보 없음')
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
        urls: [
          'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789',
          'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321',
        ],
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
