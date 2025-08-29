// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import { SENTRY_CONFIG } from '@/shared/lib/sentry-utils'

Sentry.init({
  dsn: 'https://d37773402f8b8690700c3fda3881d323@o4509283258990592.ingest.us.sentry.io/4509929025634304',

  // 환경별 설정
  environment: SENTRY_CONFIG.environment,
  release: SENTRY_CONFIG.release,
  debug: SENTRY_CONFIG.debug,

  // 에러 추적만 활성화 (성능 모니터링 비활성화)
  sampleRate: SENTRY_CONFIG.sampleRate,
  maxBreadcrumbs: SENTRY_CONFIG.maxBreadcrumbs,

  // 초기 스코프 설정
  initialScope: {
    tags: {
      component: 'server',
      feature: 'truck-harvester',
    },
  },

  // 서버 에러 필터링
  beforeSend(event, hint) {
    // 개발 환경에서만 상세 로그
    if (SENTRY_CONFIG.debug) {
      console.group('🚨 Server Sentry Error')
      console.error('Error:', hint.originalException)
      console.log('Event:', event)
      console.groupEnd()
    }

    return event
  },
})
