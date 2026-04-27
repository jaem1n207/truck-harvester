import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'
import { type PreparedListing } from '@/v2/features/listing-preparation'

import { PreparedListingStatusPanel } from '../prepared-listing-status'

const baseUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo='

const listing: TruckListing = {
  url: `${baseUrl}3`,
  vname: '현대 메가트럭',
  vehicleName: '현대 메가트럭',
  vnumber: '서울12가3456',
  price: {
    raw: 3200,
    rawWon: 32000000,
    label: '3,200만원',
    compactLabel: '3,200만원',
  },
  year: '2020',
  mileage: '120,000km',
  options: '윙바디',
  images: [
    'https://example.com/truck-1.jpg',
    'https://example.com/truck-2.jpg',
  ],
}

const items: PreparedListing[] = [
  {
    status: 'saved',
    id: 'truck-1',
    url: `${baseUrl}3`,
    label: '현대 메가트럭',
    listing,
    downloadedImages: 18,
    totalImages: 18,
    progress: 100,
  },
  {
    status: 'saving',
    id: 'listing-2',
    url: `${baseUrl}4`,
    label: '기아 봉고 냉동탑차',
    downloadedImages: 12,
    totalImages: 18,
    progress: 66,
  },
  {
    status: 'ready',
    id: 'listing-3',
    url: `${baseUrl}5`,
    label: '대우 프리마 카고',
    listing: {
      ...listing,
      url: `${baseUrl}5`,
      vname: '대우 프리마 카고',
      vehicleName: '대우 프리마 카고',
      vnumber: '부산34나7890',
    },
  },
]

describe('PreparedListingStatusPanel', () => {
  it('renders user-readable labels and completion summary without internal ids', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel items={items} />
    )

    expect(html).toContain('저장 진행 상황')
    expect(html).not.toContain('오늘 작업')
    expect(html).toContain('3대 중 1대 저장 완료')
    expect(html).toContain('현대 메가트럭')
    expect(html).toContain('기아 봉고 냉동탑차')
    expect(html).toContain('대우 프리마 카고')
    expect(html).toContain('저장 완료')
    expect(html).toContain('저장 중')
    expect(html).toContain('저장 준비 완료')
    expect(html).not.toContain('truck-1')
  })

  it('shows saving image progress', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel items={items} />
    )

    expect(html).toContain('사진 12/18')
  })

  it('shows invalid and failed messages plainly', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel
        items={[
          {
            status: 'invalid',
            id: 'listing-4',
            url: 'https://example.com/not-a-listing',
            label: '주소 확인 필요',
            message: '매물 주소인지 다시 확인해 주세요.',
          },
          {
            status: 'failed',
            id: 'listing-5',
            url: `${baseUrl}6`,
            label: '현대 파비스',
            message: '사이트 응답이 늦습니다. 잠시 후 다시 시도해 주세요.',
          },
        ]}
      />
    )

    expect(html).toContain('주소 확인 필요')
    expect(html).toContain('확인 필요')
    expect(html).toContain('매물 주소인지 다시 확인해 주세요.')
    expect(html).toContain(
      '사이트 응답이 늦습니다. 잠시 후 다시 시도해 주세요.'
    )
  })

  it('shows a no-saveable summary when every item needs attention', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel
        items={[
          {
            status: 'invalid',
            id: 'listing-4',
            url: 'https://example.com/not-a-listing',
            label: '주소 확인 필요',
            message: '매물 주소인지 다시 확인해 주세요.',
          },
          {
            status: 'failed',
            id: 'listing-5',
            url: `${baseUrl}6`,
            label: '현대 파비스',
            message: '사이트 응답이 늦습니다. 잠시 후 다시 시도해 주세요.',
          },
        ]}
      />
    )

    expect(html).toContain('저장할 수 있는 매물이 없습니다.')
    expect(html).not.toContain('저장할 매물을 확인하고 있습니다.')
  })

  it('marks the dynamic status area as a polite live region', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel items={items} />
    )

    expect(html).toContain('aria-live="polite"')
  })

  it('does not mark complete when a saved item still has a failed item beside it', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel
        items={[
          items[0],
          {
            status: 'failed',
            id: 'listing-5',
            url: `${baseUrl}6`,
            label: '현대 파비스',
            message: '사이트 응답이 늦습니다. 잠시 후 다시 시도해 주세요.',
          },
        ]}
      />
    )

    expect(html).toContain('1대 중 1대 저장 완료')
    expect(html).not.toContain('data-complete-summary="true"')
  })

  it('does not mark complete while saved items still have active neighbors', () => {
    const activeNeighbors: PreparedListing[] = [
      {
        status: 'checking',
        id: 'listing-6',
        url: `${baseUrl}7`,
        label: '매물 이름 찾는 중',
      },
      items[1],
      items[2],
    ]

    activeNeighbors.forEach((activeItem) => {
      const html = renderToStaticMarkup(
        <PreparedListingStatusPanel items={[items[0], activeItem]} />
      )

      expect(html).not.toContain('data-complete-summary="true"')
    })
  })

  it('shows a strong all-done summary when every save-relevant item is saved', () => {
    const html = renderToStaticMarkup(
      <PreparedListingStatusPanel
        items={[
          items[0],
          {
            status: 'saved',
            id: 'listing-2',
            url: `${baseUrl}4`,
            label: '기아 봉고 냉동탑차',
            downloadedImages: 18,
            totalImages: 18,
            progress: 100,
          },
        ]}
      />
    )

    expect(html).toContain('2대 저장 완료')
    expect(html).toContain('data-complete-summary="true"')
  })

  it('renders a plain empty state', () => {
    const html = renderToStaticMarkup(<PreparedListingStatusPanel items={[]} />)

    expect(html).toContain('아직 준비된 매물이 없습니다.')
  })
})
