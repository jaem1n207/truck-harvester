'use client'

import { FolderOpen } from 'lucide-react'

import {
  isFileSystemAccessAvailable,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import { v2Copy } from '@/v2/shared/lib/copy'
import { Button } from '@/v2/shared/ui/button'

interface DirectorySelectorProps {
  isSupported?: boolean
  onSelectDirectory: (directory: WritableDirectoryHandle) => void
}

async function chooseDirectory() {
  const picker = window.showDirectoryPicker

  if (!picker) {
    return undefined
  }

  try {
    return (await picker()) as WritableDirectoryHandle
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return undefined
    }

    throw error
  }
}

export function DirectorySelector({
  isSupported = isFileSystemAccessAvailable(),
  onSelectDirectory,
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
            const directory = await chooseDirectory()

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
    </section>
  )
}
