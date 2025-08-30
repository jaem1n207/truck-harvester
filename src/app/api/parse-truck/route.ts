import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { fetchHtml } from '@/shared/lib/fetch-html'
import {
  addTruckProcessingBreadcrumb,
  measureOperation,
  setTruckProcessingContext,
} from '@/shared/lib/sentry-utils'
import { type TruckData } from '@/shared/model/truck'

import {
  createApiError,
  withTruckProcessingErrorHandler,
} from '../sentry-error-handler'

// 런타임/캐시/타임아웃 고정
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

// Vercel Hobby 플랜은 서버리스 함수가 10초 제한이므로 배포 환경에서는 더 짧은 타임아웃 사용
const isProduction = process.env.NODE_ENV === 'production'
const defaultTimeout = isProduction ? 3500 : 10000 // 배포: 3.5초, 로컬: 10초
const defaultRateLimit = isProduction ? 300 : 1000 // 배포: 0.3초, 로컬: 1초

const parseRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1),
  rateLimitMs: z.number().min(100).default(defaultRateLimit),
  timeoutMs: z.number().min(1000).default(defaultTimeout),
})

async function parseHtml(
  $: Awaited<ReturnType<typeof fetchHtml>>
): Promise<Omit<TruckData, 'url'>> {
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

    // 연식과 주행거리 (.car-detail에서 추출)
    let year = '연식 정보 없음'
    let mileage = '주행거리 정보 없음'

    // 연식 추출: 첫 번째 dd의 strong.number에서 추출
    const firstDd = $('.car-detail dl dd').first()
    const yearStrong = firstDd.find('strong.number').first()
    if (yearStrong.length > 0) {
      const yearText = yearStrong.text().trim()
      if (yearText && /^\d{4}$/.test(yearText)) {
        year = yearText
      }
    }

    // 주행거리 추출: strong.red.number가 있는 dd에서 추출
    $('.car-detail dl dd').each((_, element) => {
      const ddElement = $(element)
      const mileageStrong = ddElement.find('strong.red.number')
      if (mileageStrong.length > 0 && mileage === '주행거리 정보 없음') {
        const mileageText = mileageStrong.text().trim()
        const kmText = ddElement.text()
        if (mileageText && kmText.includes('km')) {
          mileage = mileageText + 'km'
        }
      }
    })

    // 차명 추출 (.vcontent에서 "차명:" 다음 텍스트 추출)
    let extractedVname = ''
    $('.vcontent p font span b span').each((_, element) => {
      const spanText = $(element).text().trim()
      if (spanText.startsWith('차명:') && !extractedVname) {
        extractedVname = spanText.replace('차명:', '').trim()
      }
    })

    // 차명과 차종 분리 처리
    const vehicleName = extractedVname || vname // 차명: 추출된 데이터 또는 기본 vname
    // vname은 기존 그대로 유지 (차종용)

    // 기타사항/옵션 (.vcontent에서 "추가장착 옵션" 부분만 추출)
    let options = '기타사항 정보 없음'
    const vcontentHtml = $('.vcontent').html()
    if (vcontentHtml) {
      // "▶ 추가장착 옵션 ::" 다음부터 첫 번째 <br> 전까지 추출
      const optionsMatch = vcontentHtml.match(
        /▶\s*추가장착\s*옵션\s*::\s*([^<]*?)(?=<br|$)/i
      )
      if (optionsMatch && optionsMatch[1]) {
        const optionsText = optionsMatch[1].trim()
        if (optionsText) {
          // 콤마를 /로 변환하고 공백 정리
          options = optionsText.replace(/,\s*/g, ' / ').trim()
        }
      }
    }

    // 이미지 추출 (.sumnail ul li img[onmouseover*="changeImg"]에서 추출)
    const images: string[] = []

    $('.sumnail ul li img[onmouseover*="changeImg"]').each((_, element) => {
      const onmouseover = $(element).attr('onmouseover')
      if (onmouseover) {
        const match = onmouseover.match(/changeImg\(['"](.*?)['"]/)
        if (match && match[1]) {
          const imageUrl = match[1]
          // Blank_Photo_S.gif 이미지 제외
          if (
            !imageUrl.includes('/Blank_Photo_S.gif') &&
            !imageUrl.toLowerCase().includes('blank')
          ) {
            images.push(imageUrl)
          }
        }
      }
    })

    // .sumnail 내의 img src에서도 추출 (fallback) - _TH가 없는 이미지만
    $('.sumnail img').each((_, element) => {
      const src = $(element).attr('src')
      if (
        src &&
        !src.includes('_TH') &&
        !src.includes('/Blank_Photo_S.gif') &&
        !src.toLowerCase().includes('blank')
      ) {
        images.push(src)
      }
    })

    return {
      vname, // 원본 차종 데이터 유지
      vehicleName, // 추출된 차명 또는 기본 vname
      vnumber,
      price: {
        raw: priceRaw,
        rawWon: priceRawWon,
        label: priceLabel,
        compactLabel: compactLabel,
      },
      year,
      mileage,
      options,
      images: Array.from(new Set(images)), // 중복 제거
    }
  } catch (error) {
    throw new Error(
      `파싱 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

async function postHandler(request: NextRequest) {
  try {
    // 요청 데이터 검증
    const body = await request.json()
    const validation = parseRequestSchema.safeParse(body)

    if (!validation.success) {
      addTruckProcessingBreadcrumb('parsing_error', {
        error: 'validation_failed',
        details: validation.error.errors,
      })
      throw createApiError.badRequest(
        '잘못된 요청 데이터',
        'VALIDATION_ERROR',
        {
          details: validation.error.errors,
        }
      )
    }

    const { urls, rateLimitMs, timeoutMs } = validation.data

    // 컨텍스트 설정
    setTruckProcessingContext({
      operation: 'parse',
      urlCount: urls.length,
    })

    addTruckProcessingBreadcrumb('parsing_start', {
      urlCount: urls.length,
      rateLimitMs,
      timeoutMs,
      isProduction,
    })

    const results: TruckData[] = []
    const startTime = Date.now()

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]

      try {
        // Rate limiting
        if (results.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitMs))
        }

        // 개별 URL 처리를 성능 측정과 함께
        const parsedData = await measureOperation(
          `parse-truck-url-${i + 1}`,
          async () => {
            try {
              const $ = await fetchHtml(url, timeoutMs)
              return await parseHtml($)
            } catch (error) {
              // fetchHtml에서 발생한 에러를 적절한 형태로 변환
              const message =
                error instanceof Error ? error.message : 'Unknown error'
              if (message.includes('HTTP')) {
                // HTTP 에러인 경우 기존 에러 형식 유지
                throw createApiError.badRequest(message, 'HTTP_ERROR', { url })
              }
              // 기타 에러 (타임아웃, 봇 차단 등)
              throw new Error(message)
            }
          },
          { url: new URL(url).hostname, index: i + 1 }
        )

        results.push({
          url,
          ...parsedData,
        })

        addTruckProcessingBreadcrumb('parsing_success', {
          url: new URL(url).hostname,
          index: i + 1,
          totalProcessed: results.length,
          elapsedTime: Date.now() - startTime,
        })
      } catch (error) {
        // 개별 URL 파싱 실패 시 에러 결과 추가
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        const errorData = {
          url,
          vname: 'Error',
          vehicleName: 'Error',
          vnumber: 'Error',
          price: { raw: 0, rawWon: 0, label: '0만원', compactLabel: '0만원' },
          year: 'Error',
          mileage: 'Error',
          options: 'Error',
          images: [],
          error: errorMessage,
        }

        results.push(errorData)

        addTruckProcessingBreadcrumb('parsing_error', {
          url: new URL(url).hostname,
          index: i + 1,
          error: errorMessage,
          elapsedTime: Date.now() - startTime,
        })
      }
    }

    const summary = {
      total: results.length,
      success: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      executionTime: Date.now() - startTime,
    }

    addTruckProcessingBreadcrumb('parsing_success', summary)

    return NextResponse.json({
      success: true,
      data: results,
      summary,
    })
  } catch (error) {
    throw error
  }
}

// Sentry 에러 핸들러로 래핑하여 export
export const POST = withTruckProcessingErrorHandler(postHandler)
