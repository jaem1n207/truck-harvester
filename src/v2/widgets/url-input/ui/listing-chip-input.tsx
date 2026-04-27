'use client'

import { useMemo, useState, type ClipboardEvent } from 'react'

import { AlertTriangle, Check, Loader2, X } from 'lucide-react'

import { type PreparedListing } from '@/v2/features/listing-preparation'
import { v2Copy } from '@/v2/shared/lib/copy'
import { cn } from '@/v2/shared/lib/utils'
import { Button } from '@/v2/shared/ui/button'

interface ListingChipInputProps {
  items: readonly PreparedListing[]
  disabled: boolean
  duplicateMessage: string | null
  canRemoveItem?: (item: PreparedListing) => boolean
  onPasteText: (text: string) => void
  onRemove: (id: string) => void
  onStart: () => void
}

const failedRecoveryMessage =
  '확인하지 못한 매물은 지우고 다시 붙여넣어 주세요.'

const isChecking = (item: PreparedListing) => item.status === 'checking'
const isReady = (item: PreparedListing) => item.status === 'ready'

const getStatusLabel = (item: PreparedListing) => {
  switch (item.status) {
    case 'checking':
      return item.label
    case 'ready':
      return '확인 완료'
    case 'saving':
      return '저장 중'
    case 'saved':
      return '저장 완료'
    case 'invalid':
    case 'failed':
      return '확인 필요'
  }
}

function ListingChipStatus({ item }: { item: PreparedListing }) {
  const statusLabel = getStatusLabel(item)

  if (item.status === 'checking' || item.status === 'saving') {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        {statusLabel}
      </span>
    )
  }

  if (item.status === 'invalid' || item.status === 'failed') {
    return (
      <span className="text-destructive inline-flex items-center gap-1 text-xs">
        <AlertTriangle aria-hidden="true" className="size-3.5" />
        {statusLabel}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
      <Check aria-hidden="true" className="size-3.5" />
      {statusLabel}
    </span>
  )
}

export function ListingChipInput({
  items,
  disabled,
  duplicateMessage,
  canRemoveItem = () => true,
  onPasteText,
  onRemove,
  onStart,
}: ListingChipInputProps) {
  const [draftText, setDraftText] = useState('')
  const checkingItemExists = items.some(isChecking)
  const readyCount = useMemo(() => items.filter(isReady).length, [items])

  const startLabel = checkingItemExists
    ? '매물 이름 확인 중'
    : readyCount === 0
      ? '매물 주소를 넣어주세요'
      : `확인된 ${readyCount}대 저장 시작`

  const startDisabled = disabled || checkingItemExists || readyCount === 0

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text/plain')

    event.preventDefault()
    event.currentTarget.value = ''
    setDraftText('')
    onPasteText(text)
  }

  return (
    <section
      aria-labelledby="listing-chip-input-title"
      className="border-border bg-card text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
    >
      <div className="grid gap-1.5">
        <h2
          className="text-lg font-semibold text-balance"
          id="listing-chip-input-title"
        >
          {v2Copy.urlInput.title}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {v2Copy.urlInput.description}
        </p>
      </div>

      <div className="grid gap-3">
        <label className="sr-only" htmlFor="listing-chip-input-textarea">
          {v2Copy.urlInput.label}
        </label>
        <textarea
          aria-describedby="listing-chip-input-helper"
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 resize-y rounded-lg border px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow,color] outline-none focus-visible:ring-3"
          disabled={disabled}
          id="listing-chip-input-textarea"
          onChange={(event) => setDraftText(event.target.value)}
          onPaste={handlePaste}
          placeholder={v2Copy.urlInput.placeholder}
          value={draftText}
        />

        <div
          aria-live="polite"
          className="text-muted-foreground min-h-5 text-sm"
          id="listing-chip-input-helper"
        >
          {duplicateMessage ? (
            <p className="text-amber-700 dark:text-amber-300">
              {duplicateMessage}
            </p>
          ) : (
            <p>{v2Copy.urlInput.description}</p>
          )}
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2" role="list">
          {items.map((item) => {
            const needsRecovery =
              item.status === 'invalid' || item.status === 'failed'
            const canRemove = !disabled && canRemoveItem(item)

            return (
              <li
                className={cn(
                  'border-border bg-background inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-xs',
                  needsRecovery &&
                    'border-destructive/30 bg-destructive/5 text-destructive'
                )}
                key={item.id}
              >
                <span className="grid min-w-0 gap-1">
                  <span className="truncate font-medium">{item.label}</span>
                  <ListingChipStatus item={item} />
                  {needsRecovery ? (
                    <span className="text-destructive text-xs">
                      {failedRecoveryMessage}
                    </span>
                  ) : null}
                </span>

                {canRemove ? (
                  <Button
                    aria-label={`매물 지우기: ${item.label}`}
                    className="relative size-6 rounded-md before:absolute before:top-1/2 before:left-1/2 before:size-10 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
                    onClick={() => onRemove(item.id)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">매물 지우기</span>
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="flex justify-end">
        <Button
          className="tabular-nums"
          disabled={startDisabled}
          onClick={onStart}
          type="button"
        >
          {startLabel}
        </Button>
      </div>
    </section>
  )
}
