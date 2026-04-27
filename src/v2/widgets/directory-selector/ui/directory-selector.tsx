'use client'

import { FolderCheck, FolderOpen } from 'lucide-react'

import {
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import { v2Copy } from '@/v2/shared/lib/copy'
import { Button } from '@/v2/shared/ui/button'

type DirectoryPermissionState =
  | 'denied'
  | 'needs-permission'
  | 'ready'
  | 'restoring'
type DirectoryPickerStartIn = WritableDirectoryHandle | 'downloads'

interface DirectorySelectorProps {
  isSupported?: boolean
  onSelectDirectory: (
    directory: WritableDirectoryHandle
  ) => Promise<void> | void
  permissionState?: DirectoryPermissionState
  pickerStartIn?: DirectoryPickerStartIn
  selectedDirectoryName?: string
}

const pickSaveDirectory = pickWritableDirectory as (options: {
  id: string
  startIn: DirectoryPickerStartIn
}) => Promise<WritableDirectoryHandle | undefined>

export function DirectorySelector({
  isSupported = isFileSystemAccessAvailable(),
  onSelectDirectory,
  permissionState = 'ready',
  pickerStartIn,
  selectedDirectoryName,
}: DirectorySelectorProps) {
  if (!isSupported) {
    return (
      <section className="border-border bg-card text-card-foreground grid gap-2 rounded-xl border p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-balance">
          {v2Copy.directorySelector.unsupportedTitle}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
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
        <h2 className="text-lg font-semibold text-balance">
          {v2Copy.directorySelector.title}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {v2Copy.directorySelector.explainer}
        </p>
      </div>
      <div>
        <Button
          onClick={async () => {
            const directory = await pickSaveDirectory({
              id: 'truck-harvester-v2-save-folder',
              startIn: pickerStartIn ?? 'downloads',
            })

            if (directory) {
              await onSelectDirectory(directory)
            }
          }}
          type="button"
        >
          <FolderOpen aria-hidden="true" data-icon="inline-start" />
          {v2Copy.directorySelector.choose}
        </Button>
      </div>
      {selectedDirectoryName ? (
        <div className="bg-muted/50 text-foreground flex items-start gap-2 rounded-lg px-3 py-2 shadow-[inset_0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.04)]">
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
            {permissionState === 'denied' ? (
              <p className="text-muted-foreground text-xs">
                저장을 시작하면 폴더를 다시 고릅니다.
              </p>
            ) : null}
            {permissionState === 'needs-permission' ? (
              <p className="text-muted-foreground text-xs">
                저장할 때 폴더 권한을 다시 확인합니다.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
