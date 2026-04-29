import type { Metadata } from 'next'

import Script from 'next/script'

import { getUmamiScriptConfig } from './umami-script-config'
import './globals.css'
import './theme.css'

export const metadata: Metadata = {
  title: {
    default: '트럭 매물 수집기',
    template: '%s | 트럭 매물 수집기',
  },
  description:
    '중고 트럭 매물 주소를 빠르게 확인하고 차량별 이미지 폴더로 정리하는 작업 화면입니다.',
  keywords: [
    '트럭',
    '중고트럭',
    '매물수집',
    '데이터수집',
    '매물정보',
    '트럭매매',
    '상용차',
    '화물차',
  ],
  authors: [{ name: 'Truck Harvester Team' }],
  creator: 'Truck Harvester Team',
  publisher: 'Truck Harvester',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://truck-harvester.vercel.app'
  ),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    title: '트럭 매물 수집기',
    description:
      '중고 트럭 매물 주소를 확인하고 차량별 이미지 폴더로 정리합니다.',
    siteName: '트럭 매물 수집기',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '트럭 매물 수집기',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '트럭 매물 수집기',
    description:
      '중고 트럭 매물 주소를 확인하고 차량별 이미지 폴더로 정리합니다.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'productivity',
}

const umamiScriptConfig = getUmamiScriptConfig()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {umamiScriptConfig ? (
          <Script
            data-website-id={umamiScriptConfig.websiteId}
            src={umamiScriptConfig.src}
            strategy="afterInteractive"
          />
        ) : null}
        <div className="v2-theme min-h-dvh">{children}</div>
      </body>
    </html>
  )
}
