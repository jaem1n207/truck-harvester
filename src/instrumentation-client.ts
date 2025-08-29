// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import {
  SENTRY_CONFIG,
  setDeviceContext,
  setSentryTags,
  shouldCaptureError,
} from '@/shared/lib/sentry-utils'

Sentry.init({
  dsn: 'https://d37773402f8b8690700c3fda3881d323@o4509283258990592.ingest.us.sentry.io/4509929025634304',

  // 환경 설정
  environment: SENTRY_CONFIG.environment,
  release: SENTRY_CONFIG.release,
  debug: SENTRY_CONFIG.debug,

  // 에러 추적만 활성화 (성능/리플레이 비활성화)
  sampleRate: SENTRY_CONFIG.sampleRate,
  maxBreadcrumbs: SENTRY_CONFIG.maxBreadcrumbs,

  // 에러 필터링
  beforeSend(event, hint) {
    const error = hint.originalException as Error

    if (error && !shouldCaptureError(error)) {
      return null
    }

    // URL에서 민감한 정보 제거
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url)
        url.searchParams.delete('token')
        url.searchParams.delete('key')
        url.searchParams.delete('password')
        event.request.url = url.toString()
      } catch {
        // URL 파싱 실패 시 무시
      }
    }

    // 개발 환경에서만 콘솔에 로그
    if (SENTRY_CONFIG.debug && error) {
      console.group('🚨 Sentry Error Captured')
      console.error('Error:', error)
      console.log('Event:', event)
      console.log('Hint:', hint)
      console.groupEnd()
    }

    return event
  },

  // 초기 스코프 설정
  initialScope: {
    tags: {
      component: 'client',
      feature: 'truck-harvester',
    },
  },
})

// 클라이언트 초기화 시 실행
if (typeof window !== 'undefined') {
  // 기본 태그 설정
  setSentryTags({
    runtime: 'browser',
    'next.version': process.env.NEXT_PUBLIC_VERSION || 'unknown',
  })

  // 최소한의 디바이스 컨텍스트 설정
  setDeviceContext()

  // 에러 핸들러 등록
  window.addEventListener('error', (event) => {
    Sentry.addBreadcrumb({
      category: 'error',
      message: 'Global error caught',
      level: 'error',
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })

  // Promise rejection 핸들러
  window.addEventListener('unhandledrejection', (event) => {
    Sentry.addBreadcrumb({
      category: 'error',
      message: 'Unhandled promise rejection',
      level: 'error',
      data: {
        reason: event.reason?.toString(),
      },
    })
  })
}
