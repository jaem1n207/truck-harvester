import { Truck } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="bg-primary animate-pulse rounded-xl p-4">
            <Truck className="text-primary-foreground h-8 w-8 animate-bounce" />
          </div>
        </div>
        <h2 className="text-foreground mb-2 text-xl font-semibold">
          트럭 매물 수집기 로딩 중...
        </h2>
        <p className="text-muted-foreground text-sm">잠시만 기다려 주세요</p>
        <div className="mt-4 flex justify-center space-x-1">
          <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]"></div>
          <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]"></div>
          <div className="bg-primary h-2 w-2 animate-bounce rounded-full"></div>
        </div>
      </div>
    </div>
  )
}
