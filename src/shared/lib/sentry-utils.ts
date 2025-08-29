/**
 * Sentry 유틸리티 모듈
 * 저비용 에러 추적에 최적화된 설정을 제공합니다.
 */

import * as Sentry from '@sentry/nextjs'

// 저비용 에러 추적에 최적화된 설정
export const SENTRY_CONFIG = {
  // 에러 샘플링 비율
  sampleRate: 1.0,

  debug: false,

  // 환경 설정
  environment: process.env.NODE_ENV || 'development',

  // 릴리즈 버전
  release:
    process.env.SENTRY_RELEASE ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    'development',

  // 최대 브레드크럼브 수 - 메모리 효율성을 위해 제한
  maxBreadcrumbs: 20,
} as const

// 사용자 컨텍스트 설정
export interface UserContext {
  id?: string
  email?: string
  username?: string
  language?: string
  userAgent?: string
}

export const setSentryUser = (user: UserContext) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    language: user.language || 'ko',
    extras: {
      userAgent:
        user.userAgent ||
        (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
    },
  })
}

// 태그 설정 유틸리티
export const setSentryTags = (tags: Record<string, string>) => {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value)
  })
}

// 컨텍스트 설정 유틸리티
export const setSentryContext = (
  key: string,
  context: Record<string, unknown>
) => {
  Sentry.setContext(key, context)
}

// 트럭 관련 비즈니스 컨텍스트 - 핵심 정보만 추적
export const setTruckProcessingContext = (data: {
  url?: string
  urlCount?: number
  operation?: 'parse' | 'download' | 'validate'
}) => {
  setSentryContext('truck_processing', {
    url: data.url ? new URL(data.url).hostname : undefined, // 도메인만 저장
    urlCount: data.urlCount,
    operation: data.operation,
  })
}

// 에러 캡처 유틸리티
export const captureException = (
  error: Error,
  context?: {
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
    tags?: Record<string, string>
    extra?: Record<string, unknown>
    fingerprint?: string[]
  }
) => {
  Sentry.withScope((scope) => {
    if (context?.level) {
      scope.setLevel(context.level)
    }

    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }

    if (context?.fingerprint) {
      scope.setFingerprint(context.fingerprint)
    }

    Sentry.captureException(error)
  })
}

// 메시지 캡처 유틸리티
export const captureMessage = (
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
) => {
  Sentry.withScope((scope) => {
    scope.setLevel(level)

    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }

    Sentry.captureMessage(message)
  })
}

// 브레드크럼브 추가 유틸리티
export const addSentryBreadcrumb = (
  message: string,
  category: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  data?: Record<string, unknown>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

// 트럭 처리 관련 브레드크럼브
export const addTruckProcessingBreadcrumb = (
  action:
    | 'url_input'
    | 'url_validation'
    | 'parsing_start'
    | 'parsing_success'
    | 'parsing_error'
    | 'download_start'
    | 'download_progress'
    | 'download_complete'
    | 'download_error'
    | 'processing_cancelled'
    | 'processing_error'
    | 'processing_success',
  data?: Record<string, unknown>
) => {
  addSentryBreadcrumb(
    `Truck processing: ${action}`,
    'truck_processing',
    action.includes('error') ? 'error' : 'info',
    data
  )
}

// 에러와 함께 간단한 타이밍 정보만 추적하는 유틸리티
export const measureOperation = async <T>(
  operationName: string,
  fn: () => Promise<T> | T,
  context?: Record<string, unknown>
): Promise<T> => {
  const startTime = Date.now()

  try {
    const result = await fn()

    // 성공 시 브레드크럼브만 남김
    addSentryBreadcrumb(`${operationName} completed`, 'operation', 'info', {
      duration: Date.now() - startTime,
      ...context,
    })

    return result
  } catch (error) {
    // 실패 시 에러와 함께 타이밍 정보 캡처
    captureException(error as Error, {
      tags: { operation: operationName },
      extra: {
        duration: Date.now() - startTime,
        ...context,
      },
    })
    throw error
  }
}

// 에러 필터 함수
export const shouldCaptureError = (error: Error): boolean => {
  // 개발 환경에서는 모든 에러 캡처
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // 네트워크 에러 필터링
  if (
    error.message.includes('NetworkError') ||
    error.message.includes('fetch')
  ) {
    // 네트워크 에러는 샘플링
    return Math.random() < 0.1
  }

  // AbortError는 사용자가 의도적으로 취소한 것이므로 제외
  if (error.name === 'AbortError') {
    return false
  }

  // 기타 에러는 모두 캡처
  return true
}

// Next.js 라우트별 태그 설정
export const setRouteContext = (pathname: string) => {
  setSentryTags({
    route: pathname,
    page_type: pathname === '/' ? 'home' : pathname.split('/')[1] || 'unknown',
  })

  setSentryContext('navigation', {
    pathname,
    timestamp: new Date().toISOString(),
  })
}

// 최소한의 디바이스 정보만 수집 (에러 디버깅용)
export const setDeviceContext = () => {
  if (typeof window === 'undefined') return

  setSentryContext('device', {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    userAgent: navigator.userAgent,
  })
}
