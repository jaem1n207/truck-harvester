import { describe, expect, it, vi } from 'vitest'

import {
  clearPersistedDirectoryHandle,
  loadPersistedDirectoryHandle,
  queryWritableDirectoryPermission,
  requestWritableDirectoryPermission,
  savePersistedDirectoryHandle,
  type DirectoryHandleRecordStore,
} from '../directory-handle-storage'
import { type WritableDirectoryHandle } from '../file-system'

function createMemoryStore(): DirectoryHandleRecordStore {
  let savedHandle: WritableDirectoryHandle | null = null

  return {
    read: vi.fn(async () => savedHandle),
    write: vi.fn(async (handle) => {
      savedHandle = handle
    }),
    clear: vi.fn(async () => {
      savedHandle = null
    }),
  }
}

function createDirectoryHandle(
  permissions: Partial<
    Pick<WritableDirectoryHandle, 'queryPermission' | 'requestPermission'>
  > = {}
): WritableDirectoryHandle {
  return {
    kind: 'directory',
    name: '선택 폴더',
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
    ...permissions,
  }
}

describe('directory handle storage', () => {
  it('saves and loads a selected directory handle', async () => {
    const store = createMemoryStore()
    const handle = createDirectoryHandle()

    await savePersistedDirectoryHandle(handle, store)

    await expect(loadPersistedDirectoryHandle(store)).resolves.toBe(handle)
  })

  it('clears a selected directory handle', async () => {
    const store = createMemoryStore()
    const handle = createDirectoryHandle()

    await savePersistedDirectoryHandle(handle, store)
    await clearPersistedDirectoryHandle(store)

    await expect(loadPersistedDirectoryHandle(store)).resolves.toBeNull()
  })

  it('returns null when reading the store fails', async () => {
    const store: DirectoryHandleRecordStore = {
      read: vi.fn(async () => {
        throw new Error('IndexedDB read failed')
      }),
      write: vi.fn(),
      clear: vi.fn(),
    }

    await expect(loadPersistedDirectoryHandle(store)).resolves.toBeNull()
  })

  it('queries readwrite permission for a directory handle', async () => {
    const queryPermission = vi.fn(async () => 'granted' as PermissionState)
    const handle = createDirectoryHandle({ queryPermission })

    await expect(queryWritableDirectoryPermission(handle)).resolves.toBe(
      'granted'
    )
    expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('returns prompt when queryPermission is unavailable', async () => {
    const handle = createDirectoryHandle()

    await expect(queryWritableDirectoryPermission(handle)).resolves.toBe(
      'prompt'
    )
  })

  it('requests readwrite permission and returns true when granted', async () => {
    const requestPermission = vi.fn(async () => 'granted' as PermissionState)
    const handle = createDirectoryHandle({ requestPermission })

    await expect(requestWritableDirectoryPermission(handle)).resolves.toBe(true)
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('returns false when writable permission is denied', async () => {
    const requestPermission = vi.fn(async () => 'denied' as PermissionState)
    const handle = createDirectoryHandle({ requestPermission })

    await expect(requestWritableDirectoryPermission(handle)).resolves.toBe(
      false
    )
  })

  it('returns true when requestPermission is unavailable', async () => {
    const handle = createDirectoryHandle()

    await expect(requestWritableDirectoryPermission(handle)).resolves.toBe(true)
  })
})
