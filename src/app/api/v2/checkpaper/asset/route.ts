import { NextResponse } from 'next/server'

import { isAllowedCheckPaperUrl } from '@/v2/shared/lib/checkpaper-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 5

function createErrorResponse(status: number, message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  )
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
    return createErrorResponse(400, '성능점검기록부 파일을 확인하지 못했어요.')
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent': getCheckPaperUserAgent(),
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    if (!response.ok) {
      return createErrorResponse(
        502,
        '성능점검기록부 파일을 불러오지 못했어요.'
      )
    }

    const finalUrl = response.url || url
    if (!isAllowedCheckPaperUrl(finalUrl)) {
      return createErrorResponse(
        400,
        '성능점검기록부 파일을 확인하지 못했어요.'
      )
    }

    const fileBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type')

    return new Response(fileBuffer, {
      headers: {
        'content-type': contentType || 'application/octet-stream',
        'cache-control': 'no-store',
      },
    })
  } catch {
    return createErrorResponse(502, '성능점검기록부 파일을 불러오지 못했어요.')
  }
}
