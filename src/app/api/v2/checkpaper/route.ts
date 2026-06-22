import { NextResponse } from 'next/server'

import {
  CHECKPAPER_FETCH_TIMEOUT_MS,
  createTimeoutBudget,
  fetchWithManualRedirect,
  isAllowedCheckPaperUrl,
  readResponseBodyWithTimeout,
  rewriteCheckPaperHtml,
} from '@/v2/shared/lib/checkpaper-proxy'

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
      headers: {
        'cache-control': 'no-store',
      },
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
    return createErrorResponse(400, '성능점검기록부 주소를 확인하지 못했어요.')
  }

  const headers = {
    'User-Agent': getCheckPaperUserAgent(),
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  }

  try {
    const timeoutBudget = createTimeoutBudget(CHECKPAPER_FETCH_TIMEOUT_MS)

    const { response, finalUrl } = await fetchWithManualRedirect(
      url,
      headers,
      timeoutBudget
    )

    if (!response.ok) {
      return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
    }

    if (!isAllowedCheckPaperUrl(finalUrl)) {
      return createErrorResponse(
        400,
        '성능점검기록부 주소를 확인하지 못했어요.'
      )
    }

    const timeoutMs = timeoutBudget.getRemainingMs()
    if (timeoutMs <= 0) {
      return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
    }

    const html = await readResponseBodyWithTimeout(
      () => response.text(),
      timeoutMs,
      { response }
    )

    const rewrittenHtml = rewriteCheckPaperHtml(html, finalUrl)

    return new NextResponse(rewrittenHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy':
          "default-src 'none'; base-uri 'none'; script-src 'none'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; form-action 'none'; frame-ancestors 'none';",
      },
    })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'UNSAFE_REDIRECT'
    ) {
      return createErrorResponse(
        400,
        '성능점검기록부 주소를 확인하지 못했어요.'
      )
    }

    return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
  }
}
