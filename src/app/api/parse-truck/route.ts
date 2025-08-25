import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { z } from 'zod'

const parseRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1),
  rateLimitMs: z.number().min(100).default(1000),
  timeoutMs: z.number().min(1000).default(10000),
})

interface TruckData {
  url: string
  vehicleNumber: string
  title: string
  price: {
    raw: number
    label: string
  }
  firstRegistration: string
  mileage: string
  images: string[]
  error?: string
}

async function parseHtml(html: string): Promise<Omit<TruckData, 'url'>> {
  const $ = cheerio.load(html)
  
  try {
    // 가격 파싱 (p.vcash > span.red)
    const priceText = $('p.vcash > span.red').first().text().trim()
    const priceRaw = parseInt(priceText.replace(/[,\s]/g, '')) || 0
    const priceLabel = priceRaw.toLocaleString() + '만원'
    
    // 차량번호 추출 (multiple fallback selectors)
    const vehicleNumber = (
      $('.vehicle-number').text().trim() ||
      $('.car-number').text().trim() ||
      $('[class*="number"]').first().text().trim() ||
      'Unknown'
    )
    
    // 제목
    const title = (
      $('h1').first().text().trim() ||
      $('.title').first().text().trim() ||
      $('title').text().trim() ||
      '제목 없음'
    )
    
    // 최초등록일 (multiple selectors)
    const firstRegistration = (
      $('.first-registration').text().trim() ||
      $('.registration-date').text().trim() ||
      $('[class*="registration"]').first().text().trim() ||
      '정보 없음'
    )
    
    // 주행거리 (multiple selectors)  
    const mileage = (
      $('.mileage').text().trim() ||
      $('.distance').text().trim() ||
      $('[class*="mile"]').first().text().trim() ||
      '정보 없음'
    )
    
    // 이미지 추출 (onmouseover="changeImg('FULL.jpg')" 패턴)
    const images: string[] = []
    
    $('*[onmouseover*="changeImg"]').each((_, element) => {
      const onmouseover = $(element).attr('onmouseover')
      if (onmouseover) {
        const match = onmouseover.match(/changeImg\(['"](.*?)['"]/)
        if (match && match[1]) {
          const imageName = match[1]
          // FULL.jpg만 추출, _TH 썸네일 제외, Blank 이미지 제외
          if (imageName.includes('FULL.jpg') && 
              !imageName.includes('_TH') && 
              !imageName.toLowerCase().includes('blank')) {
            images.push(imageName)
          }
        }
      }
    })
    
    // 또는 img src에서 추출
    $('img').each((_, element) => {
      const src = $(element).attr('src')
      if (src && src.includes('FULL.jpg') && 
          !src.includes('_TH') && 
          !src.toLowerCase().includes('blank')) {
        images.push(src)
      }
    })
    
    return {
      vehicleNumber,
      title,
      price: {
        raw: priceRaw,
        label: priceLabel
      },
      firstRegistration,
      mileage,
      images: Array.from(new Set(images)) // 중복 제거
    }
  } catch (error) {
    throw new Error(`파싱 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { urls, rateLimitMs, timeoutMs } = parseRequestSchema.parse(body)
    
    const results: TruckData[] = []
    
    for (const url of urls) {
      try {
        // Rate limiting
        if (results.length > 0) {
          await new Promise(resolve => setTimeout(resolve, rateLimitMs))
        }
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const html = await response.text()
        const parsedData = await parseHtml(html)
        
        results.push({
          url,
          ...parsedData
        })
        
      } catch (error) {
        results.push({
          url,
          vehicleNumber: 'Error',
          title: 'Error',
          price: { raw: 0, label: '0만원' },
          firstRegistration: 'Error',
          mileage: 'Error',
          images: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({ 
      success: true,
      data: results,
      summary: {
        total: results.length,
        success: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length
      }
    })
    
  } catch (error) {
    console.error('Parse API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '잘못된 요청 데이터', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: '서버 내부 오류' },
      { status: 500 }
    )
  }
}