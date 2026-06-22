import { NextResponse } from 'next/server'

import {
  CHECKPAPER_FETCH_TIMEOUT_MS,
  createTimeoutBudget,
  fetchWithManualRedirect,
  readResponseBodyWithTimeout,
  isAllowedCheckPaperUrl,
  rewriteCheckPaperCss,
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

function isRejectedActiveDocumentContentType(
  contentType: string | null
): boolean {
  if (!contentType) {
    return false
  }

  const normalizedContentType = contentType.split(';')[0]?.trim().toLowerCase()
  const rejectedTypes = new Set([
    'text/html',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/xml',
    'text/xml',
  ])

  return (
    Boolean(normalizedContentType) && rejectedTypes.has(normalizedContentType)
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')

  if (!url || !isAllowedCheckPaperUrl(url)) {
    return createErrorResponse(400, '성능점검기록부 파일을 확인하지 못했어요.')
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
      return createErrorResponse(
        502,
        '성능점검기록부 파일을 불러오지 못했어요.'
      )
    }

    if (!isAllowedCheckPaperUrl(finalUrl)) {
      return createErrorResponse(
        400,
        '성능점검기록부 파일을 확인하지 못했어요.'
      )
    }

    const contentType = response.headers.get('content-type')
    if (isRejectedActiveDocumentContentType(contentType)) {
      return createErrorResponse(
        502,
        '성능점검기록부 파일을 불러오지 못했어요.'
      )
    }

    const timeoutMs = timeoutBudget.getRemainingMs()
    if (timeoutMs <= 0) {
      return createErrorResponse(
        502,
        '성능점검기록부 파일을 불러오지 못했어요.'
      )
    }

    if (contentType?.includes('text/css')) {
      const css = await readResponseBodyWithTimeout(
        () => response.text(),
        timeoutMs
      )
      const rewrittenCss = rewriteCheckPaperCss(css, finalUrl)

      return new Response(rewrittenCss, {
        headers: {
          'content-type': contentType,
          'cache-control': 'no-store',
        },
      })
    }

    const fileBuffer = await readResponseBodyWithTimeout(
      () => response.arrayBuffer(),
      timeoutMs
    )

    return new Response(fileBuffer, {
      headers: {
        'content-type': contentType || 'application/octet-stream',
        'cache-control': 'no-store',
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
        '성능점검기록부 파일을 확인하지 못했어요.'
      )
    }

    return createErrorResponse(502, '성능점검기록부 파일을 불러오지 못했어요.')
  }
}
