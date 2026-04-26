import { describe, expect, it } from 'vitest'

import {
  selectAllResolved,
  selectAttentionNeeded,
  selectDone,
  selectInProgress,
} from '../selectors'
import { createTruckBatchStore } from '../truck-batch-store'

const urls = [
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=1',
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=2',
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
]

describe('truck batch selectors', () => {
  it('groups failed, in-progress, done, and all-resolved states', () => {
    const store = createTruckBatchStore()
    store.getState().addUrls(urls)
    store.getState().setParsing('truck-1')
    store.getState().setFailed('truck-2', {
      reason: 'site-timeout',
      message: '사이트 응답이 늦습니다. 다시 시도해볼까요?',
    })
    store.getState().setSkipped('truck-3', '직원이 건너뛰었습니다.')

    const state = store.getState()

    expect(selectAttentionNeeded(state).map((item) => item.id)).toEqual([
      'truck-2',
    ])
    expect(selectInProgress(state).map((item) => item.id)).toEqual(['truck-1'])
    expect(selectDone(state).map((item) => item.id)).toEqual(['truck-3'])
    expect(selectAllResolved(state)).toBe(false)

    store.getState().setSkipped('truck-1', '직원이 건너뛰었습니다.')
    expect(selectAllResolved(store.getState())).toBe(true)
  })
})
