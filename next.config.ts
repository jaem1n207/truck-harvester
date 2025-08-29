import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 성능 최적화 설정
  experimental: {
    // 번들 크기 최적화
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-progress',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-toast',
      'motion',
    ],
    // Turbo 성능 향상
    turbo: {
      rules: {
        // 이미지 최적화
        '*.{png,jpg,jpeg,gif,webp,avif}': {
          loaders: ['file-loader'],
          as: '*.js',
        },
      },
    },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 1일
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 압축 설정
  compress: true,

  // 보안 헤더
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // 정적 자산 캐싱
      {
        source: '/icon',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/apple-icon',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/opengraph-image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ]
  },

  // 번들 분석 설정 (개발용)
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // 개발 환경에서 번들 분석 (선택적)
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      }
    }
    return config
  },

  env: {
    CUSTOM_KEY: process.env.NODE_ENV,
  },

  poweredByHeader: false,

  reactStrictMode: true,
}

export default withSentryConfig(nextConfig, {
  // Sentry 조직 및 프로젝트 설정
  org: 'jaemin',
  project: 'truck-harvester',

  // 소스맵 업로드 설정
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // 빌드 로그 설정 (CI에서만 로그 출력)
  silent: !process.env.CI,

  // 소스맵 업로드 범위 확장 (더 나은 스택 트레이스)
  widenClientFileUpload: true,

  tunnelRoute: '/monitoring',

  // 프로덕션에서 소스맵 숨기기는 sourcemaps.deleteSourcemapsAfterUpload로 설정됨

  // Sentry logger 자동 제거 (번들 크기 최적화)
  disableLogger: true,

  // 자동 Vercel 모니터링
  automaticVercelMonitors: true,

  // 에러 발생 시에도 빌드 계속 진행
  errorHandler: (err: Error) => {
    console.warn('Sentry webpack plugin 경고:', err.message)
    // 빌드를 중단하지 않음
  },

  // 소스맵 업로드 시 추가 옵션
  release: {
    // Git 커밋 SHA 자동 감지
    name: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

    // 릴리즈에 태그 추가
    setCommits: {
      auto: true,
      ignoreMissing: true,
      ignoreEmpty: true,
    },
  },

  // 소스맵 업로드 설정
  sourcemaps: {
    // 소스맵 업로드 활성화
    disable: false,

    // 업로드할 자산 패턴
    assets: [
      '.next/static/chunks/**',
      '.next/static/css/**',
      '.next/server/**',
    ],

    // 제외할 파일 패턴
    ignore: [
      '.next/static/chunks/webpack-*.js',
      '.next/static/chunks/framework-*.js',
      '.next/static/chunks/main-*.js',
      '.next/static/chunks/polyfills-*.js',
      'node_modules/**',
    ],

    // 업로드 후 소스맵 파일 삭제 (보안)
    deleteSourcemapsAfterUpload: true,
  },
})
