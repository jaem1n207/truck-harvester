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
  vname: string
  vnumber: string
  title: string
  price: {
    raw: number
    rawWon: number
    label: string
    compactLabel: string
  }
  year: string
  mileage: string
  options: string
  firstRegistration: string
  images: string[]
  error?: string
}

async function parseHtml(html: string): Promise<Omit<TruckData, 'url'>> {
  const $ = cheerio.load(html)
  
  try {
    // 차명 (p.vname에서 추출)
    const vname = $('p.vname').text().trim() || '차명 정보 없음'
    
    // 차량번호 (p.vnumber에서 추출)
    const vnumber = $('p.vnumber').text().trim() || '차량번호 정보 없음'
    
    // 가격 파싱 (p.vcash > span.red)
    const priceText = $('p.vcash > span.red').first().text().trim()
    const priceRaw = parseInt(priceText.replace(/[,\s]/g, '')) || 0
    const priceRawWon = priceRaw * 10000 // 만원을 원 단위로 변환
    const priceLabel = priceRaw.toLocaleString() + '만원'
    
    // 축약형 라벨 생성
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
      compactLabel = priceLabel
    }
    
    // 제목 (기존 호환성 유지)
    const title = (
      $('h1').first().text().trim() ||
      $('.title').first().text().trim() ||
      $('title').text().trim() ||
      vname || '제목 없음'
    )
    
    // 연식과 주행거리 (.car-detail strong.number에서 추출)
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
    
    // 기타사항/옵션 (.vcontent에서 추출하고 콤마를 /로 변환)
    let options = $('.vcontent').text().trim() || '기타사항 정보 없음'
    if (options !== '기타사항 정보 없음') {
      options = options.replace(/,/g, '/')
    }
    
    // 최초등록일 (기존 호환성 유지)
    const firstRegistration = year // 연식 정보를 최초등록일로 사용
    
    // 이미지 추출 (.sumnail ul li img[onmouseover*="changeImg"]에서 추출)
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
    
    // .sumnail 내의 img src에서도 추출 (fallback) - _TH가 없는 이미지만
    $('.sumnail img').each((_, element) => {
      const src = $(element).attr('src')
      if (src && 
          !src.includes('_TH') && 
          !src.toLowerCase().includes('blank')) {
        images.push(src)
      }
    })
    
    return {
      vname,
      vnumber,
      title,
      price: {
        raw: priceRaw,
        rawWon: priceRawWon,
        label: priceLabel,
        compactLabel: compactLabel
      },
      year,
      mileage,
      options,
      firstRegistration,
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
          vname: 'Error',
          vnumber: 'Error',
          title: 'Error',
          price: { raw: 0, rawWon: 0, label: '0만원', compactLabel: '0만원' },
          year: 'Error',
          mileage: 'Error',
          options: 'Error',
          firstRegistration: 'Error',
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