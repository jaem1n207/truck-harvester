// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

import { SENTRY_CONFIG } from '@/shared/lib/sentry-utils'

Sentry.init({
  dsn: 'https://d37773402f8b8690700c3fda3881d323@o4509283258990592.ingest.us.sentry.io/4509929025634304',

  // Edge 런타임 설정 (최소 구성)
  environment: SENTRY_CONFIG.environment,
  release: SENTRY_CONFIG.release,
  debug: SENTRY_CONFIG.debug,

  // 에러 추적만 활성화
  sampleRate: SENTRY_CONFIG.sampleRate,
  maxBreadcrumbs: 10, // Edge 환경에서는 메모리 제한으로 더 적게

  // 초기 스코프 설정
  initialScope: {
    tags: {
      component: 'edge',
      feature: 'truck-harvester',
    },
  },

  // Edge 환경 에러 필터링
  beforeSend(event, hint) {
    // Edge 환경에서는 최소한의 로깅
    if (SENTRY_CONFIG.debug && hint.originalException) {
      console.error(
        'Edge Sentry Error:',
        (hint.originalException as any).message
      )
    }

    return event
  },
})
