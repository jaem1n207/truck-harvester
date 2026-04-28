'use client'

import { BellOff, CheckCircle2 } from 'lucide-react'

import { Button } from '@/v2/shared/ui/button'

interface CompletionNotificationToggleProps {
  disabled?: boolean
  isAvailable: boolean
  permission: NotificationPermission | 'unsupported'
  onEnable: () => void
}

export function CompletionNotificationToggle({
  disabled = false,
  isAvailable,
  permission,
  onEnable,
}: CompletionNotificationToggleProps) {
  if (!isAvailable || permission === 'unsupported') {
    return null
  }

  if (permission === 'granted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 aria-hidden="true" className="size-4" />
        완료 알림 켜짐
      </span>
    )
  }

  if (permission === 'denied') {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm text-pretty">
        <BellOff aria-hidden="true" className="size-4 shrink-0" />
        브라우저 알림이 꺼져 있습니다
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        disabled={disabled}
        onClick={onEnable}
        size="sm"
        type="button"
        variant="outline"
      >
        완료 알림 켜기
      </Button>
      <span className="text-muted-foreground text-xs">선택 사항</span>
    </div>
  )
}
