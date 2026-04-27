import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isCompletionNotificationAvailable,
  notifyCompletion,
  requestCompletionNotificationPermission,
} from '../completion-notification'

const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'Notification'
)

const notificationTitles: string[] = []

function removeNotification() {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: undefined,
  })
}

function installNotification(permission: NotificationPermission) {
  const requestPermission = vi.fn<() => Promise<NotificationPermission>>(
    async () => permission
  )

  class MockNotification {
    static permission = permission
    static requestPermission = requestPermission

    constructor(title: string) {
      notificationTitles.push(title)
    }
  }

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: MockNotification,
  })

  return { requestPermission }
}

afterEach(() => {
  notificationTitles.length = 0
  vi.restoreAllMocks()

  if (originalNotificationDescriptor) {
    Object.defineProperty(
      window,
      'Notification',
      originalNotificationDescriptor
    )
    return
  }

  removeNotification()
})

describe('completion notification model', () => {
  it('reports unavailable when Notification is missing', () => {
    removeNotification()

    expect(isCompletionNotificationAvailable()).toBe(false)
  })

  it('requests notification permission when available', async () => {
    const { requestPermission } = installNotification('granted')

    await expect(requestCompletionNotificationPermission()).resolves.toBe(
      'granted'
    )
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('returns denied when permission cannot be requested', async () => {
    removeNotification()

    await expect(requestCompletionNotificationPermission()).resolves.toBe(
      'denied'
    )
  })

  it('sends completion notification only when permission is granted', () => {
    installNotification('granted')

    notifyCompletion(3)

    expect(notificationTitles).toEqual(['트럭 매물 3대 저장이 끝났습니다.'])
  })

  it('does nothing when permission is denied', () => {
    installNotification('denied')

    notifyCompletion(2)

    expect(notificationTitles).toEqual([])
  })

  it('does nothing when notification is unavailable', () => {
    removeNotification()

    expect(() => notifyCompletion(1)).not.toThrow()
    expect(notificationTitles).toEqual([])
  })
})
