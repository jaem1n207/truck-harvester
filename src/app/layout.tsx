import type { Metadata } from 'next'

import dynamic from 'next/dynamic'

import { ThemeProvider } from '@/shared/lib/theme-provider'

import './globals.css'

const Signature = dynamic(
  () =>
    import('@/shared/ui/animated-ui/signature').then((mod) => mod.Signature),
  {
    ssr: true,
  }
)

export const metadata: Metadata = {
  title: {
    default: '트럭 매물 수집기',
    template: '%s | 트럭 매물 수집기',
  },
  description:
    '중고 트럭 매물 정보와 이미지를 자동으로 수집하고 정리하는 웹 애플리케이션입니다. URL 입력만으로 트럭 매물 데이터를 자동 추출하여 체계적으로 관리할 수 있습니다.',
  keywords: [
    '트럭',
    '중고트럭',
    '매물수집',
    '데이터수집',
    '자동화',
    '웹스크래핑',
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
      '중고 트럭 매물 정보와 이미지를 자동으로 수집하고 정리하는 웹 애플리케이션',
    siteName: '트럭 매물 수집기',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '트럭 매물 수집기 - 중고 트럭 매물 정보와 이미지를 자동 수집',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '트럭 매물 수집기',
    description:
      '중고 트럭 매물 정보와 이미지를 자동으로 수집하고 정리하는 웹 애플리케이션',
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
  verification: {
    // Google Search Console 인증 시 추가 (현재는 불필요)
    // google: 'your-google-verification-code',
  },
  category: 'productivity',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Signature />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
