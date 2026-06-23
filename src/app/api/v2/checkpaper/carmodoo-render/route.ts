import { NextResponse } from 'next/server'

import { renderCarmodooNativeImages } from '@/v2/features/file-management/server/carmodoo-native-renderer'
import {
  CARMODOO_RENDER_MAX_PAGE_COUNT,
  isCarmodooPrintUrl,
} from '@/v2/shared/lib/carmodoo-performance-check'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 15

type CarmodooRenderer = (
  url: string,
  options: { origin: string }
) => Promise<Uint8Array[]>

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

async function readRequestUrl(request: Request) {
  try {
    const body = (await request.json()) as unknown

    if (!body || typeof body !== 'object' || !('url' in body)) {
      return undefined
    }

    return typeof body.url === 'string' ? body.url.trim() : undefined
  } catch {
    return undefined
  }
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64')
}

export function createPostHandler({ render }: { render: CarmodooRenderer }) {
  return async function POST(request: Request) {
    const url = await readRequestUrl(request)
    let parsedUrl: URL | undefined

    try {
      parsedUrl = url ? new URL(url) : undefined
    } catch {
      parsedUrl = undefined
    }

    if (!url || !parsedUrl || !isCarmodooPrintUrl(parsedUrl)) {
      return createErrorResponse(
        400,
        '성능점검기록부 주소를 확인하지 못했어요.'
      )
    }

    try {
      const origin = new URL(request.url).origin
      const images = await render(url, { origin })

      if (
        images.length === 0 ||
        images.length > CARMODOO_RENDER_MAX_PAGE_COUNT
      ) {
        return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
      }

      return NextResponse.json(
        {
          images: images.map(toBase64),
        },
        {
          headers: {
            'cache-control': 'no-store',
          },
        }
      )
    } catch {
      return createErrorResponse(502, '성능점검기록부를 불러오지 못했어요.')
    }
  }
}

export const POST = createPostHandler({
  render: renderCarmodooNativeImages,
})
