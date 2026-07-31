export const PERFORMANCE_CHECK_NOT_REGISTERED_CODE =
  'PERFORMANCE_CHECK_NOT_REGISTERED'
export const PERFORMANCE_CHECK_NOT_REGISTERED_MESSAGE =
  '등록된 성능점검기록부가 없어요.'
export const PERFORMANCE_CHECK_STATUS_HEADER = 'x-performance-check-status'
export const PERFORMANCE_CHECK_NOT_REGISTERED_STATUS = 'not_registered'

const upstreamNotRegisteredMessage = '등록된 성능점검 내역이 없습니다'

export function hasNoRegisteredPerformanceCheck(html: string) {
  return html.replace(/\s+/g, ' ').includes(upstreamNotRegisteredMessage)
}

export class PerformanceCheckNotRegisteredError extends Error {
  constructor() {
    super(PERFORMANCE_CHECK_NOT_REGISTERED_MESSAGE)
    this.name = 'PerformanceCheckNotRegisteredError'
  }
}

export const isPerformanceCheckNotRegisteredError = (error: unknown) =>
  error instanceof Error && error.name === 'PerformanceCheckNotRegisteredError'
