import { NextResponse } from 'next/server'

import { fetchHtml } from '@/shared/lib/fetch-html'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const testSites = [
  'https://httpbin.org/html', // 공개 테스트 사이트
  'https://jsonplaceholder.typicode.com/', // 공개 API
  'https://www.google.com', // 글로벌 사이트
  'https://www.naver.com', // 한국 대형 사이트
  'https://www.truck-no1.co.kr', // 대상 트럭 사이트 (메인 페이지)
]

export async function GET() {
  const results = []

  for (const url of testSites) {
    console.log(`\n=== Testing ${url} ===`)
    const startTime = Date.now()

    try {
      const $ = await fetchHtml(url, 8000) // 8초 타임아웃
      const totalTime = Date.now() - startTime
      const title = $('title').text().trim() || 'No title'
      const bodyLength = $('body').html()?.length || 0

      results.push({
        url,
        status: 'success',
        time: totalTime,
        title: title.substring(0, 100),
        bodyLength,
      })

      console.log(
        `✅ ${url}: ${totalTime}ms, title: "${title.substring(0, 50)}"`
      )
    } catch (error) {
      const totalTime = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      results.push({
        url,
        status: 'error',
        time: totalTime,
        error: errorMessage,
      })

      console.log(`❌ ${url}: ${totalTime}ms, error: ${errorMessage}`)
    }
  }

  const summary = {
    total: results.length,
    success: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'error').length,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json({
    summary,
    results,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelRegion: process.env.VERCEL_REGION,
      vercelUrl: process.env.VERCEL_URL,
    },
  })
}
