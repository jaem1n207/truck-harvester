import Link from 'next/link'

import { ArrowLeft, Truck } from 'lucide-react'

import { Button } from '@/v2/shared/ui/button'

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-dvh items-center justify-center px-6">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-muted rounded-xl p-4">
            <Truck
              aria-hidden="true"
              className="text-muted-foreground size-12"
            />
          </div>
        </div>
        <h1 className="mb-2 text-4xl font-bold">404</h1>
        <h2 className="mb-4 text-xl font-semibold">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다. 트럭 매물
          수집기 메인 페이지로 돌아가세요.
        </p>
        <Button asChild>
          <Link href="/">
            <ArrowLeft aria-hidden="true" className="size-4" />
            메인 페이지로 돌아가기
          </Link>
        </Button>
      </div>
    </div>
  )
}
