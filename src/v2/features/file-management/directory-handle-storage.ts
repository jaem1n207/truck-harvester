import { type WritableDirectoryHandle } from './file-system'

const DATABASE_NAME = 'truck-harvester-v2'
const DATABASE_VERSION = 1
const STORE_NAME = 'directory-handles'
const SELECTED_DIRECTORY_KEY = 'selected-save-directory'
const WRITABLE_PERMISSION_DESCRIPTOR = { mode: 'readwrite' } as const

export interface DirectoryHandleRecordStore {
  read: () => Promise<WritableDirectoryHandle | null>
  write: (handle: WritableDirectoryHandle) => Promise<void>
  clear: () => Promise<void>
}

function getIndexedDB() {
  return typeof indexedDB === 'undefined' ? null : indexedDB
}

function openDatabase() {
  const database = getIndexedDB()

  if (!database) {
    return Promise.resolve<IDBDatabase | null>(null)
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = database.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

function executeStoreRequest<T>(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => IDBRequest<T>
) {
  return openDatabase().then(
    (database) =>
      new Promise<T | null>((resolve, reject) => {
        if (!database) {
          resolve(null)
          return
        }

        const transaction = database.transaction(STORE_NAME, mode)
        const request = execute(transaction.objectStore(STORE_NAME))

        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () =>
          reject(request.error ?? new Error('IndexedDB request failed'))
        transaction.oncomplete = () => database.close()
        transaction.onabort = () => {
          database.close()
          reject(transaction.error ?? new Error('IndexedDB transaction failed'))
        }
      })
  )
}

export const browserDirectoryHandleRecordStore: DirectoryHandleRecordStore = {
  async read() {
    try {
      return await executeStoreRequest('readonly', (store) =>
        store.get(SELECTED_DIRECTORY_KEY)
      )
    } catch {
      return null
    }
  },
  async write(handle) {
    try {
      await executeStoreRequest('readwrite', (store) =>
        store.put(handle, SELECTED_DIRECTORY_KEY)
      )
    } catch {
      return
    }
  },
  async clear() {
    try {
      await executeStoreRequest('readwrite', (store) =>
        store.delete(SELECTED_DIRECTORY_KEY)
      )
    } catch {
      return
    }
  },
}

export async function loadPersistedDirectoryHandle(
  store: DirectoryHandleRecordStore = browserDirectoryHandleRecordStore
) {
  try {
    return await store.read()
  } catch {
    return null
  }
}

export async function savePersistedDirectoryHandle(
  handle: WritableDirectoryHandle,
  store: DirectoryHandleRecordStore = browserDirectoryHandleRecordStore
) {
  await store.write(handle)
}

export async function clearPersistedDirectoryHandle(
  store: DirectoryHandleRecordStore = browserDirectoryHandleRecordStore
) {
  await store.clear()
}

export async function queryWritableDirectoryPermission(
  handle: WritableDirectoryHandle
) {
  if (!handle.queryPermission) {
    return 'prompt' satisfies PermissionState
  }

  return handle.queryPermission(WRITABLE_PERMISSION_DESCRIPTOR)
}

export async function requestWritableDirectoryPermission(
  handle: WritableDirectoryHandle
) {
  if (!handle.requestPermission) {
    return true
  }

  try {
    return (
      (await handle.requestPermission(WRITABLE_PERMISSION_DESCRIPTOR)) ===
      'granted'
    )
  } catch {
    return false
  }
}
