import type { Metadata } from 'next'

import './globals.css'
import { ThemeProvider } from '@/shared/lib/theme-provider'

export const metadata: Metadata = {
  title: '트럭 매물 수집기',
  description:
    '중고 트럭 매물 정보와 이미지를 자동으로 수집하고 정리하는 웹 애플리케이션',
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
