'use client'

import { X } from 'lucide-react'
import { motion } from 'motion/react'

import { v2Copy } from '@/v2/shared/lib/copy'
import { useV2MotionPreset } from '@/v2/shared/lib/use-reduced-motion'
import { Button } from '@/v2/shared/ui/button'

interface UrlListProps {
  urls: readonly string[]
  onRemove: (url: string) => void
}

export function UrlList({ urls, onRemove }: UrlListProps) {
  const itemEnter = useV2MotionPreset('itemEnter')

  return (
    <section
      aria-labelledby="url-list-title"
      className="border-border bg-card text-card-foreground grid gap-3 rounded-xl border p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold" id="url-list-title">
        {v2Copy.urlList.title}
      </h2>

      {urls.length === 0 ? (
        <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
          {v2Copy.urlList.empty}
        </p>
      ) : (
        <ul className="grid gap-2" role="list">
          {urls.map((url) => (
            <motion.li
              className="border-border bg-background grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border px-3 py-2"
              data-motion="item-enter"
              key={url}
              {...itemEnter}
            >
              <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
                {url}
              </span>
              <Button
                aria-label={`${v2Copy.urlList.remove}: ${url}`}
                onClick={() => onRemove(url)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
                <span className="sr-only">{v2Copy.urlList.remove}</span>
              </Button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
