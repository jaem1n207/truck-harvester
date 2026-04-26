# V2 Persistent Folder, Listing Validation, And Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the selected save folder across visits, stop unusable listing pages from becoming save-ready, remove saved listings from the input chip list, rename the progress panel, and replace the centered onboarding modal with a spotlight tour that supports previous/next.

**Architecture:** Keep all behavior parallel to legacy under `src/app/v2/*` and `src/v2/*`. Store the File System Access directory handle in IndexedDB through a small `/v2` file-management module, but always re-check write permission before saving because browser permission can expire after all tabs close. Treat missing listing identity as a preparation validation failure, not as a parse success, so the chip and progress UI never show `확인 완료` for `차명 정보 없음`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand vanilla stores, File System Access API, IndexedDB, Motion (`motion/react`), Vitest, Playwright.

---

## Scope And Constraints

- Keep legacy `/`, `src/shared/*`, `src/widgets/*`, and `src/app/page.tsx` behavior unchanged.
- Implement only in `src/app/v2/*`, `src/v2/*`, `e2e/*`, and docs.
- Do not introduce Sentry, watermark, or legacy imports in `/v2`.
- Keep default listing preview concurrency at `5`.
- Keep all user-facing `/v2` copy Korean-only and understandable for non-technical staff.
- Do not add a third-party tour library; ADR-0005 requires a custom tour with existing `/v2` primitives and Motion presets.
- Use natural animation principles from Emil's Course: animate only opacity/transform/layout, keep UI motion at or under 250ms, use ease-out for entering, and respect reduced motion.

## File Structure

- Create `src/v2/features/file-management/directory-handle-storage.ts`
  - Owns IndexedDB persistence for the selected save directory handle.
  - Exposes permission helpers that wrap `queryPermission()` and `requestPermission()`.
- Modify `src/v2/features/file-management/file-system.ts`
  - Extends the local `WritableDirectoryHandle` type with permission methods.
  - Adds picker options (`id`, `mode`, `startIn`) so the folder picker can reopen near the remembered folder.
- Modify `src/v2/features/file-management/index.ts`
  - Exports the new persistence and permission helpers.
- Test `src/v2/features/file-management/__tests__/directory-handle-storage.test.ts`
  - Uses an injected in-memory store for deterministic storage tests.
- Modify `src/v2/features/listing-preparation/model/prepared-listing-store.ts`
  - Adds `markInvalidById()` for stale-safe invalidation.
  - Keeps saved items in the store so the progress panel can continue showing completion.
- Modify `src/v2/features/listing-preparation/model/prepare-listings.ts`
  - Rejects parsed listings whose visible name is missing or equal to `차명 정보 없음`.
- Test `src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts`
  - Covers the domain-valid but unusable listing case.
- Modify `src/app/v2/truck-harvester-v2-app.tsx`
  - Restores persisted directory handles after client mount.
  - Saves new directory handles after user selection.
  - Requests permission only from user actions: save-folder selection or save start.
  - Filters saved items out of `ListingChipInput` while preserving them in `PreparedListingStatusPanel`.
  - Wires onboarding previous-step support.
- Create: `src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx`
  - Updates progress heading expectations.
  - Adds route-level coverage that saved chips disappear from the input list after saving.
- Modify `src/v2/widgets/directory-selector/ui/directory-selector.tsx`
  - Shows remembered folder name and permission-needed copy with a folder icon.
  - Passes picker options to `pickWritableDirectory()`.
- Test `src/v2/widgets/directory-selector/ui/__tests__/directory-selector.test.tsx`
  - Covers the permission-needed folder state and picker `startIn`.
- Modify `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`
  - Renames `오늘 작업` to `저장 진행 상황`.
- Test `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`
  - Updates heading assertions.
- Modify `src/v2/shared/model/onboarding-store.ts`
  - Adds `goToPreviousStep()`.
- Test `src/v2/shared/model/__tests__/onboarding-store.test.ts`
  - Covers previous-step bounds.
- Create `src/v2/features/onboarding/lib/spotlight-geometry.ts`
  - Calculates padded spotlight rectangles and popover positions.
- Test `src/v2/features/onboarding/lib/__tests__/spotlight-geometry.test.ts`
  - Covers viewport clamping and above/below placement.
- Modify `src/v2/features/onboarding/ui/tour-overlay.tsx`
  - Renders dimmed outside regions, a highlighted target outline, anchored popover, previous/next buttons, and Motion transitions.
- Test `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`
  - Covers dialog content, previous button, target overlay markers, and Motion hooks.
- Modify `src/v2/design-system/motion.ts`
  - Adds onboarding-specific Motion presets using existing duration/easing tokens.
- Modify `src/v2/features/onboarding/lib/tour-steps.ts`
  - Keeps copy simple and updates first-step description so it does not rely on technical phrasing like duplicate handling.
- Modify `e2e/happy-path-batch.spec.ts`, `e2e/chip-input-workbench.spec.ts`, and `e2e/start-without-save-folder.spec.ts`
  - Updates user-visible heading assertions.
  - Adds persisted-directory smoke where appropriate with mocked browser APIs.
- Modify `docs/architecture.md`
  - Documents remembered save folder behavior and permission re-checks.
- Modify `docs/decisions/0005-onboarding-tour-strategy.md`
  - Documents spotlight overlay, previous/next, and reduced-motion behavior.
- Modify `src/v2/testing/__tests__/knowledge-base.test.ts` only if the docs inventory expects the new/changed decision text.

---

## Task 1: Persist Selected Save Folder Handles

**Files:**

- Create: `src/v2/features/file-management/directory-handle-storage.ts`
- Modify: `src/v2/features/file-management/file-system.ts`
- Modify: `src/v2/features/file-management/index.ts`
- Test: `src/v2/features/file-management/__tests__/directory-handle-storage.test.ts`
- Test: `src/v2/features/file-management/__tests__/file-system.test.ts`

- [ ] **Step 1: Write the failing storage and permission tests**

Add `src/v2/features/file-management/__tests__/directory-handle-storage.test.ts`:

```ts
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

const createMemoryRecordStore = (): DirectoryHandleRecordStore => {
  let storedHandle: WritableDirectoryHandle | null = null

  return {
    read: vi.fn(async () => storedHandle),
    write: vi.fn(async (handle) => {
      storedHandle = handle
    }),
    clear: vi.fn(async () => {
      storedHandle = null
    }),
  }
}

const createDirectoryHandle = (
  permission: PermissionState = 'granted'
): WritableDirectoryHandle => ({
  name: 'truck-test',
  kind: 'directory',
  getDirectoryHandle: vi.fn(),
  getFileHandle: vi.fn(),
  queryPermission: vi.fn(async () => permission),
  requestPermission: vi.fn(async () => permission),
})

describe('directory handle storage', () => {
  it('saves and loads the selected directory handle', async () => {
    const recordStore = createMemoryRecordStore()
    const handle = createDirectoryHandle()

    await savePersistedDirectoryHandle(handle, recordStore)

    await expect(loadPersistedDirectoryHandle(recordStore)).resolves.toBe(handle)
  })

  it('clears the selected directory handle', async () => {
    const recordStore = createMemoryRecordStore()
    const handle = createDirectoryHandle()

    await savePersistedDirectoryHandle(handle, recordStore)
    await clearPersistedDirectoryHandle(recordStore)

    await expect(loadPersistedDirectoryHandle(recordStore)).resolves.toBeNull()
  })

  it('queries readwrite permission before trusting a restored folder', async () => {
    const handle = createDirectoryHandle('prompt')

    await expect(queryWritableDirectoryPermission(handle)).resolves.toBe('prompt')
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('requests readwrite permission from a user-triggered action', async () => {
    const handle = createDirectoryHandle('granted')

    await expect(requestWritableDirectoryPermission(handle)).resolves.toBe(true)
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('returns false when the browser denies restored folder permission', async () => {
    const handle = createDirectoryHandle('denied')

    await expect(requestWritableDirectoryPermission(handle)).resolves.toBe(false)
  })
})
```

Update `src/v2/features/file-management/__tests__/file-system.test.ts` with a picker option assertion:

```ts
it('opens the folder picker near the remembered directory', async () => {
  const startIn = {
    name: 'truck-test',
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
  }
  const picker = vi.fn().mockResolvedValue(startIn)
  vi.stubGlobal('window', { showDirectoryPicker: picker })

  await expect(
    pickWritableDirectory({ startIn, id: 'truck-harvester-v2-save-folder' })
  ).resolves.toBe(startIn)

  expect(picker).toHaveBeenCalledWith({
    id: 'truck-harvester-v2-save-folder',
    mode: 'readwrite',
    startIn,
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/directory-handle-storage.test.ts src/v2/features/file-management/__tests__/file-system.test.ts
```

Expected: FAIL because `directory-handle-storage.ts` and picker options do not exist yet.

- [ ] **Step 3: Implement directory handle storage**

Create `src/v2/features/file-management/directory-handle-storage.ts`:

```ts
import { type WritableDirectoryHandle } from './file-system'

export interface DirectoryHandleRecordStore {
  read: () => Promise<WritableDirectoryHandle | null>
  write: (handle: WritableDirectoryHandle) => Promise<void>
  clear: () => Promise<void>
}

const databaseName = 'truck-harvester-v2'
const databaseVersion = 1
const storeName = 'directory-handles'
const selectedDirectoryKey = 'selected-save-directory'

interface StoredDirectoryHandleRecord {
  key: typeof selectedDirectoryKey
  handle: WritableDirectoryHandle
}

const getIndexedDb = () => (typeof window === 'undefined' ? undefined : window.indexedDB)

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const indexedDb = getIndexedDb()

    if (!indexedDb) {
      reject(new Error('IndexedDB is not available.'))
      return
    }

    const request = indexedDb.open(databaseName, databaseVersion)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'key' })
      }
    }

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })

const runTransaction = async <Result>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<Result>
) => {
  const database = await openDatabase()

  try {
    return await new Promise<Result>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)
      const request = work(store)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  } finally {
    database.close()
  }
}

export const browserDirectoryHandleRecordStore: DirectoryHandleRecordStore = {
  read: async () => {
    if (!getIndexedDb()) {
      return null
    }

    try {
      const record = await runTransaction<StoredDirectoryHandleRecord | undefined>(
        'readonly',
        (store) => store.get(selectedDirectoryKey)
      )

      return record?.handle ?? null
    } catch {
      return null
    }
  },
  write: async (handle) => {
    if (!getIndexedDb()) {
      return
    }

    await runTransaction<IDBValidKey>('readwrite', (store) =>
      store.put({ key: selectedDirectoryKey, handle })
    )
  },
  clear: async () => {
    if (!getIndexedDb()) {
      return
    }

    await runTransaction<undefined>('readwrite', (store) => store.delete(selectedDirectoryKey))
  },
}

export const loadPersistedDirectoryHandle = (
  store: DirectoryHandleRecordStore = browserDirectoryHandleRecordStore
) => store.read()

export const savePersistedDirectoryHandle = (
  handle: WritableDirectoryHandle,
  store: DirectoryHandleRecordStore = browserDirectoryHandleRecordStore
) => store.write(handle)

export const clearPersistedDirectoryHandle = (
  store: DirectoryHandleRecordStore = browserDirectoryHandleRecordStore
) => store.clear()

export async function queryWritableDirectoryPermission(handle: WritableDirectoryHandle) {
  if (!handle.queryPermission) {
    return 'prompt' satisfies PermissionState
  }

  return handle.queryPermission({ mode: 'readwrite' })
}

export async function requestWritableDirectoryPermission(handle: WritableDirectoryHandle) {
  if (!handle.requestPermission) {
    return true
  }

  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
}
```

Update `src/v2/features/file-management/file-system.ts`:

```ts
type DirectoryPermissionMode = 'read' | 'readwrite'
type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'

interface DirectoryPermissionDescriptor {
  mode?: DirectoryPermissionMode
}

export interface WritableDirectoryHandle {
  name?: string
  kind?: 'directory'
  queryPermission?: (descriptor?: DirectoryPermissionDescriptor) => Promise<PermissionState>
  requestPermission?: (descriptor?: DirectoryPermissionDescriptor) => Promise<PermissionState>
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<WritableDirectoryHandle>
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<WritableFileHandle>
}

interface PickWritableDirectoryOptions {
  id?: string
  startIn?: WritableDirectoryHandle | WellKnownDirectory
}

type ShowDirectoryPicker = (options?: {
  id?: string
  mode?: DirectoryPermissionMode
  startIn?: WritableDirectoryHandle | WellKnownDirectory
}) => Promise<WritableDirectoryHandle>

export async function pickWritableDirectory({ id, startIn }: PickWritableDirectoryOptions = {}) {
  const picker = window.showDirectoryPicker as ShowDirectoryPicker | undefined

  if (!picker) {
    return undefined
  }

  try {
    return await picker({
      id,
      mode: 'readwrite',
      startIn,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return undefined
    }

    throw error
  }
}
```

Update `src/v2/features/file-management/index.ts`:

```ts
export {
  browserDirectoryHandleRecordStore,
  clearPersistedDirectoryHandle,
  loadPersistedDirectoryHandle,
  queryWritableDirectoryPermission,
  requestWritableDirectoryPermission,
  savePersistedDirectoryHandle,
  type DirectoryHandleRecordStore,
} from './directory-handle-storage'
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/directory-handle-storage.test.ts src/v2/features/file-management/__tests__/file-system.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/features/file-management/directory-handle-storage.ts src/v2/features/file-management/file-system.ts src/v2/features/file-management/index.ts src/v2/features/file-management/__tests__/directory-handle-storage.test.ts src/v2/features/file-management/__tests__/file-system.test.ts
git commit -m "feat: v2 저장 폴더 기억하기"
```

---

## Task 2: Restore The Folder In The V2 App And Directory Selector

**Files:**

- Modify: `src/app/v2/truck-harvester-v2-app.tsx`
- Create: `src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx`
- Modify: `src/v2/widgets/directory-selector/ui/directory-selector.tsx`
- Modify: `src/v2/widgets/directory-selector/ui/__tests__/directory-selector.test.tsx`

- [ ] **Step 1: Write the failing widget tests**

Add these cases to `src/v2/widgets/directory-selector/ui/__tests__/directory-selector.test.tsx`:

```ts
it('shows when a remembered folder needs permission again', () => {
  const html = renderToStaticMarkup(
    <DirectorySelector
      isSupported
      onSelectDirectory={vi.fn()}
      permissionState="needs-permission"
      selectedDirectoryName="truck-test"
    />
  )

  expect(html).toContain('선택한 저장 폴더')
  expect(html).toContain('truck-test')
  expect(html).toContain('저장할 때 폴더 권한을 다시 확인합니다.')
})

it('passes a remembered folder to the picker as the starting location', async () => {
  const startIn = {
    name: 'truck-test',
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
  }
  const pickedDirectory = {
    name: 'truck-new',
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
  }
  const originalPicker = window.showDirectoryPicker
  const onSelectDirectory = vi.fn()
  window.showDirectoryPicker = vi.fn().mockResolvedValue(pickedDirectory)

  const element = DirectorySelector({
    isSupported: true,
    onSelectDirectory,
    pickerStartIn: startIn,
  })
  const click = findClickHandler(element)

  await click()

  expect(window.showDirectoryPicker).toHaveBeenCalledWith({
    id: 'truck-harvester-v2-save-folder',
    mode: 'readwrite',
    startIn,
  })
  expect(onSelectDirectory).toHaveBeenCalledWith(pickedDirectory)

  window.showDirectoryPicker = originalPicker
})
```

Create `src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx`:

```ts
import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }

  container?.remove()
  root = null
  container = null
  vi.doUnmock('@/v2/features/file-management')
  vi.doUnmock('@/v2/features/listing-preparation')
  vi.resetModules()
})

describe('TruckHarvesterV2App persisted directory', () => {
  it('keeps a restored folder name visible after the client mounts', async () => {
    const restoredDirectory = {
      name: 'truck-test',
      kind: 'directory' as const,
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn(),
      queryPermission: vi.fn(async () => 'granted' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
    }

    vi.doMock('@/v2/features/file-management', async (importOriginal) => {
      const actual =
        await importOriginal<typeof import('@/v2/features/file-management')>()

      return {
        ...actual,
        isFileSystemAccessAvailable: () => true,
        loadPersistedDirectoryHandle: vi.fn(async () => restoredDirectory),
        queryWritableDirectoryPermission: vi.fn(async () => 'granted'),
      }
    })

    const { TruckHarvesterV2App } = await import('../truck-harvester-v2-app')

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<TruckHarvesterV2App />)
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('선택한 저장 폴더')
    expect(container.textContent).toContain('truck-test')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/widgets/directory-selector/ui/__tests__/directory-selector.test.tsx src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx
```

Expected: FAIL because the selector has no permission state or picker start props and the app does not load persisted directory handles.

- [ ] **Step 3: Implement selector props and app restore flow**

Update `src/v2/widgets/directory-selector/ui/directory-selector.tsx`:

```ts
import {
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'

type DirectoryPermissionState = 'ready' | 'needs-permission' | 'restoring'

interface DirectorySelectorProps {
  isSupported?: boolean
  onSelectDirectory: (directory: WritableDirectoryHandle) => void | Promise<void>
  permissionState?: DirectoryPermissionState
  pickerStartIn?: WritableDirectoryHandle | 'downloads'
  selectedDirectoryName?: string
}
```

Replace the button click:

```ts
onClick={async () => {
  const directory = await pickWritableDirectory({
    id: 'truck-harvester-v2-save-folder',
    startIn: pickerStartIn ?? 'downloads',
  })

  if (directory) {
    await onSelectDirectory(directory)
  }
}}
```

Inside the selected-folder block, add the permission copy:

```tsx
{
  permissionState === 'needs-permission' ? (
    <p className="text-muted-foreground text-xs">저장할 때 폴더 권한을 다시 확인합니다.</p>
  ) : null
}
```

Update `src/app/v2/truck-harvester-v2-app.tsx` imports:

```ts
import {
  downloadTruckZip,
  isFileSystemAccessAvailable,
  loadPersistedDirectoryHandle,
  pickWritableDirectory,
  queryWritableDirectoryPermission,
  requestWritableDirectoryPermission,
  savePersistedDirectoryHandle,
  saveTruckToDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
```

Add state:

```ts
const [rememberedDirectory, setRememberedDirectory] = useState<WritableDirectoryHandle | null>(null)
const [directoryPermissionState, setDirectoryPermissionState] = useState<
  'ready' | 'needs-permission' | 'restoring'
>('restoring')
```

Add a client-only restore effect after file-system support is detected:

```ts
useEffect(() => {
  if (!fileSystemSupported) {
    setDirectoryPermissionState('ready')
    return
  }

  let isCanceled = false

  void loadPersistedDirectoryHandle().then(async (restoredDirectory) => {
    if (isCanceled || !restoredDirectory) {
      if (!isCanceled) {
        setDirectoryPermissionState('ready')
      }
      return
    }

    const permission = await queryWritableDirectoryPermission(restoredDirectory)

    if (isCanceled) {
      return
    }

    setRememberedDirectory(restoredDirectory)

    if (permission === 'granted') {
      setDirectory(restoredDirectory)
      setDirectoryPermissionState('ready')
      return
    }

    setDirectoryPermissionState('needs-permission')
  })

  return () => {
    isCanceled = true
  }
}, [fileSystemSupported])
```

Add a helper:

```ts
const rememberSelectedDirectory = async (nextDirectory: WritableDirectoryHandle) => {
  if (!isMountedRef.current) {
    return
  }

  setDirectory(nextDirectory)
  setRememberedDirectory(nextDirectory)
  setDirectoryPermissionState('ready')
  await savePersistedDirectoryHandle(nextDirectory)
}
```

Update `resolveSaveDirectoryForRun()` so restored handles are re-authorized from the save button gesture:

```ts
const existingDirectory = directory ?? rememberedDirectory

if (existingDirectory) {
  const hasPermission = await requestWritableDirectoryPermission(existingDirectory)

  if (!hasPermission) {
    if (isMountedRef.current) {
      setDirectoryPermissionState('needs-permission')
    }
    return undefined
  }

  await rememberSelectedDirectory(existingDirectory)
  return existingDirectory
}

const nextDirectory = await pickWritableDirectory({
  id: 'truck-harvester-v2-save-folder',
  startIn: 'downloads',
})
```

After picking a new directory, call:

```ts
await rememberSelectedDirectory(nextDirectory)
```

Update the rendered selector:

```tsx
<DirectorySelector
  isSupported={fileSystemSupported}
  onSelectDirectory={(nextDirectory) => void rememberSelectedDirectory(nextDirectory)}
  permissionState={directoryPermissionState}
  pickerStartIn={directory ?? rememberedDirectory ?? 'downloads'}
  selectedDirectoryName={(directory ?? rememberedDirectory)?.name}
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/widgets/directory-selector/ui/__tests__/directory-selector.test.tsx src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/v2/truck-harvester-v2-app.tsx src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx src/v2/widgets/directory-selector/ui/directory-selector.tsx src/v2/widgets/directory-selector/ui/__tests__/directory-selector.test.tsx
git commit -m "feat: v2 저장 폴더 복원 연결"
```

---

## Task 3: Reject Parsed Listings Without Real Listing Identity

**Files:**

- Modify: `src/v2/features/listing-preparation/model/prepared-listing-store.ts`
- Modify: `src/v2/features/listing-preparation/model/prepare-listings.ts`
- Test: `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`
- Test: `src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts`:

```ts
it('marks a checking item invalid by id without touching newer same-url items', () => {
  const store = createPreparedListingStore()
  const url = firstUrl

  store.getState().addUrls([url])
  const originalItem = store.getState().items[0]
  store.getState().remove(originalItem.id)
  store.getState().addUrls([url])

  store
    .getState()
    .markInvalidById(originalItem.id, '매물 정보를 찾지 못했어요. 주소를 다시 확인해 주세요.')

  expect(store.getState().items).toMatchObject([
    {
      status: 'checking',
      url,
    },
  ])
})
```

Add to `src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts`:

```ts
it('does not mark a page with missing listing identity ready', async () => {
  const store = createPreparedListingStore()
  const url = buildUrl(32)
  const parse = vi.fn(async () => ({
    ...createListing(url, 32),
    vname: '차명 정보 없음',
    vehicleName: '차명 정보 없음',
  }))

  await prepareListingUrls({ urls: [url], store, parse })

  expect(store.getState().items).toMatchObject([
    {
      status: 'invalid',
      url,
      label: '주소 확인 필요',
      message: '매물 정보를 찾지 못했어요. 주소를 다시 확인해 주세요.',
    },
  ])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts
```

Expected: FAIL because `markInvalidById()` and missing-identity validation do not exist.

- [ ] **Step 3: Implement stale-safe invalidation and listing usability guard**

Update `PreparedListingState` in `prepared-listing-store.ts`:

```ts
markInvalidById: (id: string, message: string) => void
```

Add implementation near `markInvalid`:

```ts
markInvalidById: (id, message) =>
  set((state) => ({
    items: updateById(state.items, id, (item) =>
      item.status === 'checking'
        ? {
            status: 'invalid',
            id: item.id,
            url: item.url,
            label: invalidLabel,
            message,
          }
        : item
    ),
  })),
```

Update `src/v2/features/listing-preparation/model/prepare-listings.ts`:

```ts
const missingListingIdentityMessage = '매물 정보를 찾지 못했어요. 주소를 다시 확인해 주세요.'
const missingTruckNameLabel = '차명 정보 없음'

function hasUsableListingIdentity(listing: TruckListing) {
  const candidateNames = [listing.vname, listing.vehicleName].map((value) => value.trim())

  return candidateNames.some((value) => value.length > 0 && value !== missingTruckNameLabel)
}
```

Inside the parse success block, replace `markReadyById` with:

```ts
const listing = await parse(url, signal)

if (!hasUsableListingIdentity(listing)) {
  store.getState().markInvalidById(itemId, missingListingIdentityMessage)
  return
}

store.getState().markReadyById(itemId, listing)
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/features/listing-preparation/model/prepared-listing-store.ts src/v2/features/listing-preparation/model/prepare-listings.ts src/v2/features/listing-preparation/model/__tests__/prepared-listing-store.test.ts src/v2/features/listing-preparation/model/__tests__/prepare-listings.test.ts
git commit -m "fix: v2 빈 매물 정보 저장 방지"
```

---

## Task 4: Remove Saved Listings From Input Chips And Rename Progress Panel

**Files:**

- Modify: `src/app/v2/truck-harvester-v2-app.tsx`
- Modify: `src/app/v2/__tests__/page.test.tsx`
- Modify: `src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx`
- Modify: `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`
- Modify: `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`
- Modify: `e2e/chip-input-workbench.spec.ts`
- Modify: `e2e/happy-path-batch.spec.ts`

- [ ] **Step 1: Write failing tests for copy and chip visibility**

Update `src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx`:

```ts
expect(html).toContain('저장 진행 상황')
expect(html).not.toContain('오늘 작업')
```

Update `src/app/v2/__tests__/page.test.tsx` copy assertions:

```ts
expect(html).toContain('저장 진행 상황')
expect(html).not.toContain('오늘 작업')
```

Add a route-level chip cleanup test to `src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx`:

```ts
it('hides saved listings from the input chips while keeping progress history', async () => {
  const savedListing = {
    status: 'saved' as const,
    id: 'listing-1',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
    label: '[활어차]포터2 슈퍼캡',
    downloadedImages: 1,
    totalImages: 1,
    progress: 100 as const,
  }

  vi.doMock('@/v2/features/listing-preparation', async (importOriginal) => {
    const actual =
      await importOriginal<typeof import('@/v2/features/listing-preparation')>()
    const store = actual.createPreparedListingStore()
    store.setState({ items: [savedListing], nextId: 2 })

    return {
      ...actual,
      createPreparedListingStore: () => store,
    }
  })

  const { TruckHarvesterV2App } = await import('../truck-harvester-v2-app')

  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(<TruckHarvesterV2App />)
  })

  const inputRegion = container.querySelector('[data-tour="url-input"]')
  const statusRegion = container.querySelector('[data-tour="processing-status"]')

  expect(statusRegion?.textContent).toContain('[활어차]포터2 슈퍼캡')
  expect(inputRegion?.textContent).not.toContain('[활어차]포터2 슈퍼캡')
  expect(inputRegion?.textContent).not.toContain('확인된 1대 저장 시작')

  vi.doUnmock('@/v2/features/listing-preparation')
})
```

Update E2E assertions that look for `오늘 작업` to `저장 진행 상황`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx src/app/v2/__tests__/page.test.tsx src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx
```

Expected: FAIL because the old heading still renders and saved items still feed `ListingChipInput`.

- [ ] **Step 3: Implement copy and chip filtering**

In `src/v2/widgets/processing-status/ui/prepared-listing-status.tsx`, change the heading:

```tsx
저장 진행 상황
```

In `src/app/v2/truck-harvester-v2-app.tsx`, derive chip-visible items:

```ts
const chipInputItems = preparedState.items.filter((item) => item.status !== 'saved')
```

Pass the filtered list only to the input:

```tsx
<ListingChipInput
  canRemoveItem={canRemovePreparedItem}
  disabled={isSaving}
  duplicateMessage={duplicateMessage}
  items={chipInputItems}
  onPasteText={handlePasteText}
  onRemove={(id) => preparedStore.getState().remove(id)}
  onStart={() => void startSavingReadyListings()}
/>
```

Keep the full list in the progress panel:

```tsx
<PreparedListingStatusPanel items={preparedState.items} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx src/app/v2/__tests__/page.test.tsx src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run focused E2E specs**

Run:

```bash
bun run test:e2e -- e2e/chip-input-workbench.spec.ts e2e/happy-path-batch.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/v2/truck-harvester-v2-app.tsx src/app/v2/__tests__/page.test.tsx src/app/v2/__tests__/truck-harvester-v2-app-persistence.test.tsx src/v2/widgets/processing-status/ui/prepared-listing-status.tsx src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx e2e/chip-input-workbench.spec.ts e2e/happy-path-batch.spec.ts
git commit -m "feat: v2 저장 완료 매물 입력 목록 정리"
```

---

## Task 5: Add Onboarding Previous Step And Spotlight Geometry

**Files:**

- Modify: `src/v2/shared/model/onboarding-store.ts`
- Modify: `src/v2/shared/model/__tests__/onboarding-store.test.ts`
- Create: `src/v2/features/onboarding/lib/spotlight-geometry.ts`
- Create: `src/v2/features/onboarding/lib/__tests__/spotlight-geometry.test.ts`
- Modify: `src/v2/features/onboarding/lib/tour-steps.ts`
- Modify: `src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts`

- [ ] **Step 1: Write failing store and geometry tests**

Add to `src/v2/shared/model/__tests__/onboarding-store.test.ts`:

```ts
it('moves to the previous tour step without going below the first step', () => {
  const store = createOnboardingStore({ storage: createMemoryStorage() })

  store.getState().restartTour()
  store.getState().goToNextStep(3)
  expect(store.getState().currentStep).toBe(1)

  store.getState().goToPreviousStep()
  expect(store.getState().currentStep).toBe(0)

  store.getState().goToPreviousStep()
  expect(store.getState().currentStep).toBe(0)
})
```

Create `src/v2/features/onboarding/lib/__tests__/spotlight-geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { getPopoverPosition, getSpotlightRect, type ViewportRect } from '../spotlight-geometry'

const viewport: ViewportRect = {
  width: 1200,
  height: 800,
}

describe('spotlight geometry', () => {
  it('adds padding around the target while staying inside the viewport', () => {
    expect(getSpotlightRect({ left: 20, top: 30, width: 300, height: 120 }, viewport, 12)).toEqual({
      left: 8,
      top: 18,
      width: 324,
      height: 144,
    })
  })

  it('clamps the spotlight when the target touches the viewport edge', () => {
    expect(getSpotlightRect({ left: 2, top: 4, width: 100, height: 80 }, viewport, 16)).toEqual({
      left: 0,
      top: 0,
      width: 118,
      height: 100,
    })
  })

  it('places the popover below the target when there is room', () => {
    expect(
      getPopoverPosition({ left: 100, top: 100, width: 320, height: 120 }, viewport, {
        width: 384,
        height: 220,
      })
    ).toEqual({
      left: 100,
      top: 236,
    })
  })

  it('places the popover above the target near the bottom of the screen', () => {
    expect(
      getPopoverPosition({ left: 100, top: 650, width: 320, height: 120 }, viewport, {
        width: 384,
        height: 220,
      })
    ).toEqual({
      left: 100,
      top: 414,
    })
  })
})
```

Update `src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts` first-step copy assertion:

```ts
expect(tourSteps[0].description).toBe(
  '복사한 매물 주소를 이 칸에 붙여넣으면, 매물 이름을 자동으로 찾아 보여줍니다.'
)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/shared/model/__tests__/onboarding-store.test.ts src/v2/features/onboarding/lib/__tests__/spotlight-geometry.test.ts src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts
```

Expected: FAIL because `goToPreviousStep()` and spotlight geometry do not exist and the first-step copy still mentions duplicate handling.

- [ ] **Step 3: Implement previous-step state, geometry, and simpler copy**

Update `src/v2/shared/model/onboarding-store.ts`:

```ts
export interface OnboardingState {
  isTourOpen: boolean
  hasCompletedTour: boolean
  currentStep: number
  initializeTour: () => void
  completeTour: () => void
  restartTour: () => void
  goToNextStep: (totalSteps: number) => void
  goToPreviousStep: () => void
}
```

Add the action:

```ts
goToPreviousStep: () =>
  set((state) => ({
    currentStep: Math.max(state.currentStep - 1, 0),
  })),
```

Create `src/v2/features/onboarding/lib/spotlight-geometry.ts`:

```ts
export interface TargetRect {
  left: number
  top: number
  width: number
  height: number
}

export interface ViewportRect {
  width: number
  height: number
}

interface PopoverSize {
  width: number
  height: number
}

const viewportMargin = 16
const targetGap = 16

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum)

export function getSpotlightRect(
  target: TargetRect,
  viewport: ViewportRect,
  padding = 10
): TargetRect {
  const left = clamp(target.left - padding, 0, viewport.width)
  const top = clamp(target.top - padding, 0, viewport.height)
  const right = clamp(target.left + target.width + padding, 0, viewport.width)
  const bottom = clamp(target.top + target.height + padding, 0, viewport.height)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

export function getPopoverPosition(
  spotlight: TargetRect,
  viewport: ViewportRect,
  popover: PopoverSize
) {
  const left = clamp(
    spotlight.left,
    viewportMargin,
    viewport.width - popover.width - viewportMargin
  )
  const belowTop = spotlight.top + spotlight.height + targetGap
  const aboveTop = spotlight.top - popover.height - targetGap
  const top =
    belowTop + popover.height + viewportMargin <= viewport.height
      ? belowTop
      : clamp(aboveTop, viewportMargin, viewport.height - popover.height - viewportMargin)

  return {
    left,
    top,
  }
}
```

Update first step copy in `src/v2/features/onboarding/lib/tour-steps.ts`:

```ts
description:
  '복사한 매물 주소를 이 칸에 붙여넣으면, 매물 이름을 자동으로 찾아 보여줍니다.',
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/shared/model/__tests__/onboarding-store.test.ts src/v2/features/onboarding/lib/__tests__/spotlight-geometry.test.ts src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/v2/shared/model/onboarding-store.ts src/v2/shared/model/__tests__/onboarding-store.test.ts src/v2/features/onboarding/lib/spotlight-geometry.ts src/v2/features/onboarding/lib/__tests__/spotlight-geometry.test.ts src/v2/features/onboarding/lib/tour-steps.ts src/v2/features/onboarding/lib/__tests__/tour-steps.test.ts
git commit -m "feat: v2 온보딩 단계 이동 준비"
```

---

## Task 6: Build The Spotlight Onboarding Overlay

**Files:**

- Modify: `src/v2/design-system/motion.ts`
- Modify: `src/v2/features/onboarding/ui/tour-overlay.tsx`
- Modify: `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`
- Modify: `src/app/v2/truck-harvester-v2-app.tsx`

- [ ] **Step 1: Write failing overlay tests**

Update `src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx`:

```ts
it('renders previous and next controls with spotlight layers', () => {
  const html = renderToStaticMarkup(
    <TourOverlay
      currentStep={1}
      isOpen
      onClose={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      steps={tourSteps}
    />
  )

  expect(html).toContain('role="dialog"')
  expect(html).toContain('이전')
  expect(html).toContain('다음')
  expect(html).toContain('data-tour-dim="top"')
  expect(html).toContain('data-tour-highlight="true"')
  expect(html).toContain('data-motion="tour-card"')
})

it('disables the previous control on the first step', () => {
  const html = renderToStaticMarkup(
    <TourOverlay
      currentStep={0}
      isOpen
      onClose={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      steps={tourSteps}
    />
  )

  expect(html).toContain('disabled=""')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx
```

Expected: FAIL because `onPrevious`, spotlight layers, and new Motion markers do not exist.

- [ ] **Step 3: Add onboarding Motion presets**

Update `src/v2/design-system/motion.ts`:

```ts
tourCard: {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: {
    duration: v2MotionDurations.default / 1000,
    ease: v2MotionEasings.easeOut,
  },
},
tourHighlight: {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: {
    duration: v2MotionDurations.quick / 1000,
    ease: v2MotionEasings.easeOut,
  },
},
```

- [ ] **Step 4: Implement spotlight overlay**

Update `src/v2/features/onboarding/ui/tour-overlay.tsx` imports:

```ts
import { useEffect, useState } from 'react'

import { motion } from 'motion/react'

import { useV2MotionPreset } from '@/v2/shared/lib/use-reduced-motion'

import { findTourAnchor, type TourStep, tourSteps } from '../lib/tour-steps'
import {
  getPopoverPosition,
  getSpotlightRect,
  type TargetRect,
  type ViewportRect,
} from '../lib/spotlight-geometry'
```

Update props:

```ts
interface TourOverlayProps {
  isOpen: boolean
  currentStep: number
  steps?: readonly TourStep[]
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}
```

Add helpers and state:

```ts
const fallbackSpotlight: TargetRect = {
  left: 24,
  top: 120,
  width: 320,
  height: 140,
}

const popoverSize = {
  width: 384,
  height: 230,
}
```

Inside the component:

```ts
const tourCard = useV2MotionPreset('tourCard')
const tourHighlight = useV2MotionPreset('tourHighlight')
const [spotlight, setSpotlight] = useState<TargetRect>(fallbackSpotlight)
const viewport: ViewportRect =
  typeof window === 'undefined'
    ? { width: 1024, height: 768 }
    : { width: window.innerWidth, height: window.innerHeight }

useEffect(() => {
  if (!isOpen) {
    return
  }

  const updateSpotlight = () => {
    const anchor = findTourAnchor(step)
    const rect = anchor?.getBoundingClientRect()

    if (!rect) {
      setSpotlight(fallbackSpotlight)
      return
    }

    setSpotlight(
      getSpotlightRect(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        {
          width: window.innerWidth,
          height: window.innerHeight,
        }
      )
    )
  }

  updateSpotlight()
  window.addEventListener('resize', updateSpotlight)
  window.addEventListener('scroll', updateSpotlight, true)

  return () => {
    window.removeEventListener('resize', updateSpotlight)
    window.removeEventListener('scroll', updateSpotlight, true)
  }
}, [isOpen, step])
```

Render the dim layers, highlight, and card:

```tsx
const popoverPosition = getPopoverPosition(spotlight, viewport, popoverSize)
const isFirstStep = currentStep === 0

return (
  <div aria-modal="true" className="fixed inset-0 z-50" role="dialog">
    <div
      aria-hidden="true"
      className="fixed top-0 right-0 left-0 bg-black/55"
      data-tour-dim="top"
      style={{ height: spotlight.top }}
    />
    <div
      aria-hidden="true"
      className="fixed left-0 bg-black/55"
      data-tour-dim="left"
      style={{
        top: spotlight.top,
        width: spotlight.left,
        height: spotlight.height,
      }}
    />
    <div
      aria-hidden="true"
      className="fixed right-0 bg-black/55"
      data-tour-dim="right"
      style={{
        top: spotlight.top,
        left: spotlight.left + spotlight.width,
        height: spotlight.height,
      }}
    />
    <div
      aria-hidden="true"
      className="fixed right-0 bottom-0 left-0 bg-black/55"
      data-tour-dim="bottom"
      style={{ top: spotlight.top + spotlight.height }}
    />

    <motion.div
      aria-hidden="true"
      className="ring-primary/70 pointer-events-none fixed rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.45)] ring-2"
      data-motion="tour-highlight"
      data-tour-highlight="true"
      style={spotlight}
      {...tourHighlight}
    />

    <motion.div
      className="border-border bg-card text-card-foreground fixed w-[min(24rem,calc(100vw-2rem))] rounded-xl border p-5 shadow-lg"
      data-motion="tour-card"
      key={step.id}
      style={{
        left: popoverPosition.left,
        top: popoverPosition.top,
      }}
      {...tourCard}
    >
      <div className="grid gap-2">
        <p className="text-muted-foreground text-xs font-medium">
          {currentStep + 1} / {steps.length}
        </p>
        <h2 className="text-lg font-semibold">{step.title}</h2>
        <p className="text-muted-foreground text-sm">{step.description}</p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          className="text-muted-foreground hover:bg-muted rounded-lg px-3 py-2 text-sm"
          onClick={onClose}
          type="button"
        >
          그만 보기
        </button>
        <div className="flex gap-2">
          <button
            className="text-muted-foreground hover:bg-muted disabled:text-muted-foreground/50 rounded-lg px-3 py-2 text-sm"
            disabled={isFirstStep}
            onClick={onPrevious}
            type="button"
          >
            이전
          </button>
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-2 text-sm font-medium"
            onClick={onNext}
            type="button"
          >
            {isLastStep ? '마치기' : '다음'}
          </button>
        </div>
      </div>
    </motion.div>
  </div>
)
```

Update `src/app/v2/truck-harvester-v2-app.tsx`:

```tsx
<TourOverlay
  currentStep={onboardingState.currentStep}
  isOpen={onboardingState.isTourOpen}
  onClose={onboardingState.completeTour}
  onNext={() => onboardingState.goToNextStep(tourSteps.length)}
  onPrevious={onboardingState.goToPreviousStep}
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx src/app/v2/__tests__/page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/v2/design-system/motion.ts src/v2/features/onboarding/ui/tour-overlay.tsx src/v2/features/onboarding/ui/__tests__/tour-overlay.test.tsx src/app/v2/truck-harvester-v2-app.tsx
git commit -m "feat: v2 온보딩 스포트라이트 추가"
```

---

## Task 7: Browser, A11y, And Documentation Verification

**Files:**

- Modify: `e2e/start-without-save-folder.spec.ts`
- Modify: `docs/architecture.md`
- Modify: `docs/decisions/0005-onboarding-tour-strategy.md`
- Modify: `src/v2/testing/__tests__/knowledge-base.test.ts` if its assertions require the updated docs text.

- [ ] **Step 1: Add a persisted-directory E2E smoke**

In `e2e/start-without-save-folder.spec.ts`, extend the folder-picker setup so the picker returns a handle with permission methods:

```ts
window.showDirectoryPicker = async () => ({
  name: 'truck-test',
  kind: 'directory',
  queryPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  async getDirectoryHandle() {
    return this
  },
  async getFileHandle() {
    return {
      async createWritable() {
        return {
          async write() {},
          async close() {},
        }
      },
    }
  },
})
```

Add assertions after the first folder choice:

```ts
await expect(page.getByText('선택한 저장 폴더')).toBeVisible()
await expect(page.getByText('truck-test')).toBeVisible()
```

Reload and assert the folder still appears:

```ts
await page.reload()
await expect(page.getByText('선택한 저장 폴더')).toBeVisible()
await expect(page.getByText('truck-test')).toBeVisible()
```

- [ ] **Step 2: Update docs with exact behavior**

In `docs/architecture.md`, add under the `/v2` file-management section:

```md
The `/v2` save-folder selector stores the selected
`FileSystemDirectoryHandle` in IndexedDB so a refreshed or returning
Chromium user can see the last selected folder. The app still calls
`queryPermission({ mode: 'readwrite' })` after restore and
`requestPermission({ mode: 'readwrite' })` from a user-triggered save
action before writing, because browser permission can expire when the
origin's tabs close.
```

In `docs/decisions/0005-onboarding-tour-strategy.md`, extend the decision:

```md
The tour uses a spotlight overlay: the active `data-tour` anchor stays
visible, unrelated page regions are dimmed, and the explanation card is
placed near the active element. The tour supports previous/next controls
and keeps animation limited to opacity, transform, and position changes
through `/v2` Motion presets with reduced-motion fallbacks.
```

- [ ] **Step 3: Run focused E2E and a11y verification**

Run:

```bash
bun run test:e2e -- e2e/start-without-save-folder.spec.ts e2e/chip-input-workbench.spec.ts e2e/happy-path-batch.spec.ts
bun run test:a11y
```

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
bun run test:coverage -- --run
bun run build
```

Expected:

- Typecheck, lint, format, unit tests, coverage, and build pass.
- Build may continue to print existing legacy Sentry or CSS warnings, but no new `/v2` Sentry/watermark imports should appear.

- [ ] **Step 5: Run guardrail scan**

Run:

```bash
rg -n "Sentry|sentry|watermark|@/shared|@/widgets" src/app/v2 src/v2
```

Expected: no runtime `/v2` Sentry, watermark, `@/shared`, or `@/widgets` imports. Documentation references are acceptable only outside runtime source.

- [ ] **Step 6: Commit docs and E2E**

```bash
git add e2e/start-without-save-folder.spec.ts docs/architecture.md docs/decisions/0005-onboarding-tour-strategy.md src/v2/testing/__tests__/knowledge-base.test.ts
git commit -m "docs: v2 저장과 온보딩 흐름 갱신"
```

---

## Self-Review Checklist

- [ ] Requirement 1 covered: Task 1 stores directory handles in IndexedDB; Task 2 restores and re-authorizes them.
- [ ] Requirement 2 covered: Task 3 prevents `차명 정보 없음` from becoming `확인 완료`.
- [ ] Requirement 3 covered: Task 4 removes saved listings from the input chip list while preserving progress history.
- [ ] Requirement 4 covered: Task 4 renames `오늘 작업` to `저장 진행 상황`.
- [ ] Requirement 5 covered: Tasks 5 and 6 build anchored spotlight onboarding with dimming, previous/next, and Motion.
- [ ] Legacy route safety covered: all planned source edits stay inside `src/app/v2/*` and `src/v2/*`.
- [ ] No Sentry/watermark covered: Task 7 includes a guardrail scan.
- [ ] Default concurrency remains `5`: Task 3 changes validation after parse only and does not change `defaultConcurrency`.
- [ ] Korean-only UI copy covered: all new user-facing strings are Korean.
- [ ] Tests are paired with implementation tasks and each task has a focused command before commit.
