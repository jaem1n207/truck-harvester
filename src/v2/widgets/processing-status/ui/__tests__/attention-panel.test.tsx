import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'
import { type FailedBatchItem } from '@/v2/shared/model'

import { AttentionPanel } from '../attention-panel'

const failedItems: FailedBatchItem[] = [
  {
    status: 'failed',
    id: 'truck-1',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
    reason: 'site-timeout',
    message: '사이트 응답이 늦습니다. 다시 시도해볼까요?',
    failedAt: '2026-04-26T00:00:00.000Z',
  },
]

describe('AttentionPanel', () => {
  it('renders failed items with retry and skip controls', () => {
    const html = renderToStaticMarkup(
      <AttentionPanel items={failedItems} onRetry={vi.fn()} onSkip={vi.fn()} />
    )

    expect(html).toContain(v2Copy.attentionPanel.title)
    expect(html).toContain(v2Copy.attentionPanel.retry)
    expect(html).toContain(v2Copy.attentionPanel.skip)
    expect(html).toContain(failedItems[0].message)
    expect(html).toContain('data-tour="attention-panel"')
  })
})
