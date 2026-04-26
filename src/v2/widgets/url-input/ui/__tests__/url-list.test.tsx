import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { v2Copy } from '@/v2/shared/lib/copy'

import { UrlList } from '../url-list'

const urls = [
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4',
]

describe('UrlList', () => {
  it('renders a Korean empty state when there are no addresses', () => {
    const html = renderToStaticMarkup(<UrlList urls={[]} onRemove={vi.fn()} />)

    expect(html).toContain(v2Copy.urlList.title)
    expect(html).toContain(v2Copy.urlList.empty)
  })

  it('renders entered addresses with remove controls', () => {
    const html = renderToStaticMarkup(
      <UrlList urls={urls} onRemove={vi.fn()} />
    )

    expect(html).toContain('OnCarNo=3')
    expect(html).toContain('OnCarNo=4')
    expect(html).toContain(v2Copy.urlList.remove)
    expect(html).toContain('data-motion="item-enter"')
  })
})
