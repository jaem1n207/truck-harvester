import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'
import { type TruckBatchItem } from '@/v2/shared/model'

import { ProcessingStatus } from '../processing-status'

const items: TruckBatchItem[] = [
  {
    status: 'parsing',
    id: 'truck-1',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
    startedAt: '2026-04-26T00:00:00.000Z',
  },
  {
    status: 'downloaded',
    id: 'truck-2',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4',
    downloadedImages: 3,
    totalImages: 3,
    progress: 100,
    completedAt: '2026-04-26T00:00:01.000Z',
  },
]

describe('ProcessingStatus', () => {
  it('renders Korean status summary and per-item states', () => {
    const html = renderToStaticMarkup(<ProcessingStatus items={items} />)

    expect(html).toContain(v2Copy.processingStatus.title)
    expect(html).toContain(v2Copy.processingStatus.inProgress)
    expect(html).toContain(v2Copy.processingStatus.downloaded)
    expect(html).toContain('truck-1')
    expect(html).toContain('truck-2')
    expect(html).toContain('data-tour="processing-status"')
    expect(html).toContain('data-motion="stream-pop"')
  })
})
