import { motion } from 'motion/react'

import { v2Copy } from '@/v2/shared/lib/copy'
import { useV2MotionPreset } from '@/v2/shared/lib/use-reduced-motion'
import {
  selectDone,
  selectInProgress,
  type TruckBatchItem,
  type TruckBatchState,
} from '@/v2/shared/model'

interface ProcessingStatusProps {
  items: readonly TruckBatchItem[]
}

const statusLabel: Record<TruckBatchItem['status'], string> = {
  pending: v2Copy.processingStatus.pending,
  parsing: v2Copy.processingStatus.parsing,
  parsed: v2Copy.processingStatus.parsed,
  downloading: v2Copy.processingStatus.downloading,
  downloaded: v2Copy.processingStatus.downloaded,
  failed: v2Copy.processingStatus.failed,
  skipped: v2Copy.processingStatus.skipped,
}

const asState = (items: readonly TruckBatchItem[]): TruckBatchState =>
  ({ items }) as TruckBatchState

export function ProcessingStatus({ items }: ProcessingStatusProps) {
  const state = asState(items)
  const inProgressCount = selectInProgress(state).length
  const doneCount = selectDone(state).length
  const streamPop = useV2MotionPreset('streamPop')

  return (
    <section
      aria-labelledby="processing-status-title"
      className="border-border bg-card text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
      data-tour="processing-status"
    >
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold" id="processing-status-title">
          {v2Copy.processingStatus.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {v2Copy.processingStatus.inProgress} {inProgressCount}개 ·{' '}
          {v2Copy.processingStatus.done} {doneCount}개
        </p>
      </div>

      <ul className="grid gap-2" role="list">
        {items.map((item) => (
          <motion.li
            className="border-border bg-background grid gap-1 rounded-lg border px-3 py-2"
            data-motion="stream-pop"
            key={item.id}
            {...streamPop}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{item.id}</span>
              <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs">
                {statusLabel[item.status]}
              </span>
            </div>
            {'progress' in item ? (
              <div
                aria-label={`${item.id} ${item.progress}%`}
                className="bg-muted h-2 overflow-hidden rounded-full"
                role="progressbar"
              >
                <div
                  className="bg-primary h-full"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            ) : null}
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
