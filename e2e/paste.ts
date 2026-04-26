import { type Locator } from '@playwright/test'

export async function pasteTextInto(locator: Locator, text: string) {
  await locator.focus()
  await locator.evaluate((element, pastedText) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', pastedText)

    let pasteEvent: Event

    try {
      pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    } catch {
      pasteEvent = new Event('paste', {
        bubbles: true,
        cancelable: true,
      })
    }

    if (!('clipboardData' in pasteEvent) || !pasteEvent.clipboardData) {
      Object.defineProperty(pasteEvent, 'clipboardData', {
        configurable: true,
        value: clipboardData,
      })
    }

    element.dispatchEvent(pasteEvent)
  }, text)
}
