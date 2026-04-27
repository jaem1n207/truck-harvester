import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

import { type PreparedListing } from '@/v2/features/listing-preparation'
import { cn } from '@/v2/shared/lib/utils'

interface PreparedListingStatusPanelProps {
  items: readonly PreparedListing[]
}

const statusLabels: Record<PreparedListing['status'], string> = {
  checking: '확인 중',
  ready: '저장 준비 완료',
  invalid: '주소 확인 필요',
  failed: '확인 필요',
  saving: '저장 중',
  saved: '저장 완료',
}

const saveRelevantStatuses = new Set<PreparedListing['status']>([
  'ready',
  'saving',
  'saved',
])

const isSaveRelevant = (item: PreparedListing) =>
  saveRelevantStatuses.has(item.status)

const getSummary = (items: readonly PreparedListing[]) => {
  const saveRelevantItems = items.filter(isSaveRelevant)
  const totalCount = saveRelevantItems.length
  const savedCount = saveRelevantItems.filter(
    (item) => item.status === 'saved'
  ).length
  const isComplete =
    items.length > 0 && items.every((item) => item.status === 'saved')

  if (isComplete) {
    return {
      text: `${savedCount}대 저장 완료`,
      isComplete,
    }
  }

  if (totalCount === 0) {
    return {
      text: items.some((item) => item.status === 'checking')
        ? '저장할 매물을 확인하고 있습니다.'
        : '저장할 수 있는 매물이 없습니다.',
      isComplete,
    }
  }

  return {
    text: `${totalCount}대 중 ${savedCount}대 저장 완료`,
    isComplete,
  }
}

function PreparedListingStatusIcon({ item }: { item: PreparedListing }) {
  if (item.status === 'checking' || item.status === 'saving') {
    return (
      <Loader2
        aria-hidden="true"
        className="text-muted-foreground size-4 animate-spin"
      />
    )
  }

  if (item.status === 'invalid' || item.status === 'failed') {
    return (
      <AlertTriangle aria-hidden="true" className="text-destructive size-4" />
    )
  }

  return (
    <CheckCircle2
      aria-hidden="true"
      className="size-4 text-emerald-700 dark:text-emerald-300"
    />
  )
}

function PreparedListingMessage({ item }: { item: PreparedListing }) {
  if (item.status === 'saving') {
    return (
      <p className="text-muted-foreground text-sm tabular-nums">
        사진 {item.downloadedImages}/{item.totalImages}
      </p>
    )
  }

  if (item.status === 'invalid' || item.status === 'failed') {
    return <p className="text-muted-foreground text-sm">{item.message}</p>
  }

  return null
}

export function PreparedListingStatusPanel({
  items,
}: PreparedListingStatusPanelProps) {
  const summary = getSummary(items)

  return (
    <section
      aria-labelledby="prepared-listing-status-title"
      className="border-border bg-card text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
      data-tour="prepared-listing-status"
    >
      <div className="grid gap-1.5">
        <h2
          className="text-lg font-semibold text-balance"
          id="prepared-listing-status-title"
        >
          저장 진행 상황
        </h2>
        <p
          className={cn(
            'text-sm tabular-nums',
            summary.isComplete
              ? 'font-semibold text-emerald-700 dark:text-emerald-300'
              : 'text-muted-foreground'
          )}
          data-complete-summary={summary.isComplete ? true : undefined}
        >
          {summary.text}
        </p>
      </div>

      <div aria-live="polite">
        {items.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            아직 준비된 매물이 없습니다.
          </p>
        ) : (
          <ul className="grid gap-2" role="list">
            {items.map((item) => (
              <li
                className="border-border bg-background grid gap-2 rounded-lg border px-3 py-3"
                key={item.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-semibold text-pretty">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                      item.status === 'invalid' || item.status === 'failed'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <PreparedListingStatusIcon item={item} />
                    {statusLabels[item.status]}
                  </span>
                </div>
                <PreparedListingMessage item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
