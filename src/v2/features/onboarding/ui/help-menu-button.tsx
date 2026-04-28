'use client'

import { CircleHelp } from 'lucide-react'

import { Button } from '@/v2/shared/ui/button'

interface HelpMenuButtonProps {
  disabled?: boolean
  onRestartTour: () => void
}

export function HelpMenuButton({
  disabled = false,
  onRestartTour,
}: HelpMenuButtonProps) {
  return (
    <Button
      disabled={disabled}
      onClick={onRestartTour}
      type="button"
      variant="outline"
    >
      <CircleHelp aria-hidden="true" data-icon="inline-start" />
      도움말
      <span className="sr-only">처음 안내 다시 보기</span>
    </Button>
  )
}
