import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TourExampleCard } from '../tour-example-card'

const forbiddenTechnicalCopy = new RegExp(
  [
    'API',
    ['Sen', 'try'].join(''),
    ['water', 'mark'].join(''),
    'directory handle',
  ].join('|')
)

describe('TourExampleCard', () => {
  it('shows the full address example and the confirmed chip result', () => {
    const html = renderToStaticMarkup(<TourExampleCard kind="url-example" />)

    expect(html).toContain('주소창 전체 복사')
    expect(html).toContain('https://www.truck-no1.co.kr/model/DetailView.asp?')
    expect(html).toContain('DetailView.asp?...처럼 앞부분이 빠진 주소')
    expect(html).toContain('덤프 메가트럭 4.5톤')
    expect(html).toContain('확인 완료')
  })

  it('shows the selected folder and per-truck folder result', () => {
    const html = renderToStaticMarkup(<TourExampleCard kind="folder-example" />)

    expect(html).toContain('저장 폴더 고르기')
    expect(html).toContain('truck-test')
    expect(html).toContain('서울80바1234')
    expect(html).toContain('차량정보.txt')
  })

  it('shows saving, saved, and optional notification examples', () => {
    const html = renderToStaticMarkup(
      <TourExampleCard kind="progress-example" />
    )

    expect(html).toContain('저장 중')
    expect(html).toContain('저장 완료')
    expect(html).toContain('완료 알림')
    expect(html).toContain('원하면 켤 수 있어요')
  })

  it('keeps user-facing copy Korean and avoids technical backend words', () => {
    const html = (
      ['url-example', 'folder-example', 'progress-example'] as const
    )
      .map((kind) => renderToStaticMarkup(<TourExampleCard kind={kind} />))
      .join('')

    expect(html).toMatch(/[가-힣]/)
    expect(html).not.toMatch(forbiddenTechnicalCopy)
  })
})
