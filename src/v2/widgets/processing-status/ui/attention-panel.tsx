'use client'

import { RotateCcw, SkipForward } from 'lucide-react'

import { v2Copy } from '@/v2/shared/lib/copy'
import { type FailedBatchItem } from '@/v2/shared/model'
import { Button } from '@/v2/shared/ui/button'

interface AttentionPanelProps {
  items: readonly FailedBatchItem[]
  onRetry: (id: string) => void
  onSkip: (id: string) => void
}

export function AttentionPanel({
  items,
  onRetry,
  onSkip,
}: AttentionPanelProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="attention-panel-title"
      className="border-destructive/30 bg-destructive/5 text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
      data-tour="attention-panel"
    >
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold" id="attention-panel-title">
          {v2Copy.attentionPanel.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {v2Copy.attentionPanel.description}
        </p>
      </div>

      <ul className="grid gap-2" role="list">
        {items.map((item) => (
          <li
            className="border-border bg-background grid gap-3 rounded-lg border px-3 py-3"
            key={item.id}
          >
            <div className="grid gap-1">
              <span className="text-sm font-medium">{item.id}</span>
              <p className="text-muted-foreground text-sm">{item.message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onRetry(item.id)}
                type="button"
                variant="secondary"
              >
                <RotateCcw aria-hidden="true" data-icon="inline-start" />
                {v2Copy.attentionPanel.retry}
              </Button>
              <Button
                onClick={() => onSkip(item.id)}
                type="button"
                variant="ghost"
              >
                <SkipForward aria-hidden="true" data-icon="inline-start" />
                {v2Copy.attentionPanel.skip}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
