import { NextResponse } from 'next/server'

import { z } from 'zod'

import { normalizeTruckUrl, normalizedTruckUrlSchema } from '@/v2/entities/url'
import { parseTruckHtml } from '@/v2/shared/lib/parse-truck-html'

import { fetchListingHtml } from './fetch-listing-html'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 5

const parseTruckRequestSchema = z.object({
  url: normalizedTruckUrlSchema,
  timeoutMs: z.number().int().min(500).max(3500).default(3500),
})

function createErrorResponse(
  status: number,
  reason: 'invalid-address' | 'site-timeout' | 'missing-data' | 'unknown',
  message: string
) {
  return NextResponse.json(
    {
      success: false,
      reason,
      message,
    },
    { status }
  )
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    (('name' in error && error.name === 'AbortError') ||
      ('code' in error && error.code === 'ABORT_ERR'))
  )
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return createErrorResponse(
      400,
      'invalid-address',
      '주소 내용을 다시 확인해 주세요.'
    )
  }

  const result = parseTruckRequestSchema.safeParse(body)

  if (!result.success) {
    return createErrorResponse(
      400,
      'invalid-address',
      result.error.issues[0]?.message || '매물 주소를 다시 확인해 주세요.'
    )
  }

  const url = normalizeTruckUrl(result.data.url)

  try {
    const html = await fetchListingHtml(url, result.data.timeoutMs)
    const listing = parseTruckHtml(html, url)

    return NextResponse.json({
      success: true,
      data: listing,
    })
  } catch (error) {
    if (isAbortError(error)) {
      return createErrorResponse(
        504,
        'site-timeout',
        '사이트 응답이 늦습니다. 다시 시도해볼까요?'
      )
    }

    return createErrorResponse(
      502,
      'unknown',
      '매물 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    )
  }
}
