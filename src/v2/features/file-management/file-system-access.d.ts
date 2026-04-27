import { type WritableDirectoryHandle } from './file-system'

type WellKnownWritableDirectory = 'desktop' | 'documents' | 'downloads'

interface WritableDirectoryPickerOptions {
  id?: string
  mode?: 'readwrite'
  startIn?: WritableDirectoryHandle | WellKnownWritableDirectory
}

declare global {
  interface Window {
    showDirectoryPicker?: (
      options?: WritableDirectoryPickerOptions
    ) => Promise<WritableDirectoryHandle>
  }
}

export {}
