'use client'

import { Bell } from 'lucide-react'

import { Button } from '@/v2/shared/ui/button'

interface CompletionNotificationToggleProps {
  isAvailable: boolean
  permission: NotificationPermission | 'unsupported'
  onEnable: () => void
}

export function CompletionNotificationToggle({
  isAvailable,
  permission,
  onEnable,
}: CompletionNotificationToggleProps) {
  if (!isAvailable || permission === 'unsupported') {
    return null
  }

  if (permission === 'granted') {
    return (
      <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium">
        <Bell aria-hidden="true" className="size-4" />
        완료 알림 켜짐
      </span>
    )
  }

  if (permission === 'denied') {
    return (
      <span className="text-muted-foreground text-sm">
        브라우저 알림이 꺼져 있습니다
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button onClick={onEnable} size="sm" type="button" variant="outline">
        완료 알림 켜기
      </Button>
      <span className="text-muted-foreground text-xs">선택 사항</span>
    </div>
  )
}
