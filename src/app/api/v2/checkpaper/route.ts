import { NextResponse } from 'next/server'

import {
  isAllowedCheckPaperUrl,
  rewriteCheckPaperHtml,
} from '@/v2/shared/lib/checkpaper-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 5

function createErrorResponse(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

function getCheckPaperUserAgent() {
  return (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/131.0.0.0 Safari/537.36'
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')

  if (!url || !isAllowedCheckPaperUrl(url)) {
    return createErrorResponse(400, '성능점검기록부 주소를 확인하지 못했어요.')
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent': getCheckPaperUserAgent(),
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    if (!response.ok) {
      return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
    }

    const finalUrl = response.url || url

    if (!isAllowedCheckPaperUrl(finalUrl)) {
      return createErrorResponse(
        400,
        '성능점검기록부 주소를 확인하지 못했어요.'
      )
    }

    const html = await response.text()
    const rewrittenHtml = rewriteCheckPaperHtml(html, finalUrl)

    return new NextResponse(rewrittenHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  } catch {
    return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
  }
}
