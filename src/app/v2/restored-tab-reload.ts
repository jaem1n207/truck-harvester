const restoredTabReloadKey = 'truck-harvester:v2:restored-tab-reloaded'

interface RestoredTabReloadWindow {
  addEventListener: (
    name: 'pageshow',
    listener: (event: { persisted: boolean }) => void
  ) => void
  location: {
    reload: () => void
  }
  performance?: {
    getEntriesByType: (type: 'navigation') => readonly unknown[]
  }
  removeEventListener: (
    name: 'pageshow',
    listener: (event: { persisted: boolean }) => void
  ) => void
  sessionStorage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>
}

function getNavigationType(windowLike: RestoredTabReloadWindow) {
  if (!windowLike.performance?.getEntriesByType) {
    return undefined
  }

  const navigationEntry =
    windowLike.performance.getEntriesByType('navigation')[0]

  if (
    navigationEntry &&
    typeof navigationEntry === 'object' &&
    'type' in navigationEntry &&
    typeof navigationEntry.type === 'string'
  ) {
    return navigationEntry.type
  }

  return undefined
}

function reloadOnce(windowLike: RestoredTabReloadWindow) {
  if (windowLike.sessionStorage.getItem(restoredTabReloadKey) === '1') {
    return false
  }

  windowLike.sessionStorage.setItem(restoredTabReloadKey, '1')
  windowLike.location.reload()
  return true
}

export function installRestoredTabReloadGuard(
  windowLike: RestoredTabReloadWindow = window
) {
  const reloadIfRestored = (isRestored: boolean) => {
    if (!isRestored) {
      windowLike.sessionStorage.removeItem(restoredTabReloadKey)
      return false
    }

    return reloadOnce(windowLike)
  }

  if (reloadIfRestored(getNavigationType(windowLike) === 'back_forward')) {
    return () => undefined
  }

  const handlePageShow = (event: { persisted: boolean }) => {
    reloadIfRestored(event.persisted)
  }

  windowLike.addEventListener('pageshow', handlePageShow)

  return () => windowLike.removeEventListener('pageshow', handlePageShow)
}
