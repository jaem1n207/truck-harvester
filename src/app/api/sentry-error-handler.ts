/**
 * API 라우트용 Sentry 에러 핸들링 유틸리티
 * Next.js 15 App Router API Routes에서 사용하는 통합 에러 처리 미들웨어
 */

import { NextRequest, NextResponse } from 'next/server'

import {
  captureException,
  setTruckProcessingContext,
} from '@/shared/lib/sentry-utils'

export interface ApiErrorContext {
  operation?: string
  url?: string
  method?: string
  userId?: string
  metadata?: Record<string, string>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * API 라우트를 래핑하여 자동 에러 처리 및 Sentry 리포팅 제공
 */
export function withSentryApiErrorHandler<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
  defaultContext?: ApiErrorContext
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const context: ApiErrorContext = {
      method: req.method,
      url: req.url,
      operation: defaultContext?.operation || 'api_request',
      ...defaultContext,
    }

    try {
      // 트럭 처리 관련 컨텍스트 설정
      if (context.url && context.url.includes('/api/parse-truck')) {
        setTruckProcessingContext({
          operation: 'parse',
          url: context.url,
        })
      }

      const response = await handler(req, ...args)

      // 성공 케이스 - 개발 환경에서만 로깅
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `✅ API ${context.method} ${new URL(context.url || '').pathname} - ${Date.now() - startTime}ms`
        )
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      // 에러 정보 수집
      const errorInfo = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError',
        statusCode: error instanceof ApiError ? error.statusCode : 500,
        code: error instanceof ApiError ? error.code : undefined,
        context: error instanceof ApiError ? error.context : undefined,
      }

      // Sentry에 에러 리포팅
      captureException(error as Error, {
        tags: {
          api_route: new URL(context.url || '').pathname,
          method: context.method || 'unknown',
          operation: context.operation || 'unknown',
        },
        extra: {
          duration,
          requestUrl: context.url,
          context: context.metadata,
          apiError: errorInfo,
        },
        level: errorInfo.statusCode >= 500 ? 'error' : 'warning',
      })

      // 개발 환경에서 상세 로깅
      if (process.env.NODE_ENV === 'development') {
        console.group(
          `🚨 API Error ${context.method} ${new URL(context.url || '').pathname}`
        )
        console.error('Error:', error)
        console.error('Context:', context)
        console.error('Duration:', `${duration}ms`)
        console.groupEnd()
      }

      // 클라이언트에 에러 응답
      return NextResponse.json(
        {
          error: {
            message: errorInfo.message,
            code: errorInfo.code || 'INTERNAL_ERROR',
            ...(process.env.NODE_ENV === 'development' && {
              stack: errorInfo.stack,
              context: errorInfo.context,
            }),
          },
        },
        { status: errorInfo.statusCode }
      )
    }
  }
}

/**
 * 간소화된 에러 핸들러 - 기본 설정으로 래핑
 */
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return withSentryApiErrorHandler(handler)
}

/**
 * 트럭 처리 전용 에러 핸들러
 */
export function withTruckProcessingErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return withSentryApiErrorHandler(handler, {
    operation: 'truck_processing',
  })
}

/**
 * 일반적인 API 에러 생성 헬퍼
 */
export const createApiError = {
  badRequest: (
    message: string,
    code?: string,
    context?: Record<string, unknown>
  ) => new ApiError(message, 400, code, context),

  unauthorized: (message: string = '인증이 필요합니다', code?: string) =>
    new ApiError(message, 401, code),

  forbidden: (message: string = '접근 권한이 없습니다', code?: string) =>
    new ApiError(message, 403, code),

  notFound: (message: string = '리소스를 찾을 수 없습니다', code?: string) =>
    new ApiError(message, 404, code),

  tooManyRequests: (message: string = '요청이 너무 많습니다', code?: string) =>
    new ApiError(message, 429, code),

  internal: (
    message: string = '서버 내부 오류가 발생했습니다',
    code?: string,
    context?: Record<string, unknown>
  ) => new ApiError(message, 500, code, context),

  serviceUnavailable: (
    message: string = '서비스를 일시적으로 이용할 수 없습니다',
    code?: string
  ) => new ApiError(message, 503, code),
}
