import type { Metadata } from 'next'

import './theme.css'

export const metadata: Metadata = {
  title: '새 트럭 매물 수집기',
  description:
    '중고 트럭 매물 주소를 빠르게 확인하고 차량별 이미지 폴더로 정리하는 새 작업 화면입니다.',
}

export default function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="v2-theme min-h-dvh">{children}</div>
}
