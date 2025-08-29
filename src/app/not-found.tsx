import Link from 'next/link'

import { ArrowLeft, Truck } from 'lucide-react'

import { Button } from '@/shared/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-muted rounded-xl p-4">
            <Truck className="text-muted-foreground h-12 w-12" />
          </div>
        </div>
        <h1 className="text-foreground mb-2 text-4xl font-bold">404</h1>
        <h2 className="text-foreground mb-4 text-xl font-semibold">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다. 트럭 매물
          수집기 메인 페이지로 돌아가세요.
        </p>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            메인 페이지로 돌아가기
          </Link>
        </Button>
      </div>
    </div>
  )
}
