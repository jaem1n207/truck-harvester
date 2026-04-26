'use client'

import { FolderCheck, FolderOpen } from 'lucide-react'

import {
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import { v2Copy } from '@/v2/shared/lib/copy'
import { Button } from '@/v2/shared/ui/button'

interface DirectorySelectorProps {
  isSupported?: boolean
  onSelectDirectory: (directory: WritableDirectoryHandle) => void
  selectedDirectoryName?: string
}

export function DirectorySelector({
  isSupported = isFileSystemAccessAvailable(),
  onSelectDirectory,
  selectedDirectoryName,
}: DirectorySelectorProps) {
  if (!isSupported) {
    return (
      <section className="border-border bg-card text-card-foreground grid gap-2 rounded-xl border p-5 shadow-sm">
        <h2 className="text-lg font-semibold">
          {v2Copy.directorySelector.unsupportedTitle}
        </h2>
        <p className="text-muted-foreground text-sm">
          {v2Copy.directorySelector.unsupportedDescription}
        </p>
      </section>
    )
  }

  return (
    <section
      className="border-border bg-card text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
      data-tour="directory-selector"
    >
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold">
          {v2Copy.directorySelector.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {v2Copy.directorySelector.explainer}
        </p>
      </div>
      <div>
        <Button
          onClick={async () => {
            const directory = await pickWritableDirectory()

            if (directory) {
              onSelectDirectory(directory)
            }
          }}
          type="button"
        >
          <FolderOpen aria-hidden="true" data-icon="inline-start" />
          {v2Copy.directorySelector.choose}
        </Button>
      </div>
      {selectedDirectoryName ? (
        <div className="border-border bg-muted/40 text-foreground flex items-start gap-2 rounded-lg border px-3 py-2">
          <FolderCheck
            aria-hidden="true"
            className="text-primary mt-0.5 size-4 shrink-0"
            data-selected-folder-icon="true"
          />
          <div className="grid min-w-0 gap-0.5">
            <p className="text-muted-foreground text-xs font-medium">
              선택한 저장 폴더
            </p>
            <p className="truncate text-sm font-medium">
              {selectedDirectoryName}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
