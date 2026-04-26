function getNotificationApi() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!('Notification' in window) || !window.Notification) {
    return null
  }

  return window.Notification
}

export function isCompletionNotificationAvailable() {
  return getNotificationApi() !== null
}

export async function requestCompletionNotificationPermission(): Promise<NotificationPermission> {
  const notificationApi = getNotificationApi()

  if (!notificationApi) {
    return 'denied'
  }

  return notificationApi.requestPermission()
}

export function notifyCompletion(count: number) {
  const notificationApi = getNotificationApi()

  if (!notificationApi || notificationApi.permission !== 'granted') {
    return
  }

  new notificationApi(`트럭 매물 ${count}대 저장이 끝났습니다.`)
}
