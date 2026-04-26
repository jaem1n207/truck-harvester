import { act } from 'react'

import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'
import {
  type PreparedListing,
  type ReadyPreparedListing,
} from '@/v2/features/listing-preparation'

import { ListingChipInput } from '../listing-chip-input'

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }

  container?.remove()
  root = null
  container = null
})

const truckListing: TruckListing = {
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
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
  images: [],
}

const readyItem: ReadyPreparedListing = {
  status: 'ready',
  id: 'listing-1',
  url: truckListing.url,
  label: '현대 메가트럭',
  listing: truckListing,
}

const items: PreparedListing[] = [
  readyItem,
  {
    status: 'checking',
    id: 'listing-2',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=4',
    label: '매물 이름 찾는 중',
  },
  {
    status: 'failed',
    id: 'listing-3',
    url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=5',
    label: '매물 이름을 확인하지 못했어요',
    message: '사이트 응답이 늦습니다.',
  },
]

const renderChipInput = (
  props: Partial<React.ComponentProps<typeof ListingChipInput>> = {}
) => (
  <ListingChipInput
    disabled={false}
    duplicateMessage={null}
    items={items}
    onPasteText={vi.fn()}
    onRemove={vi.fn()}
    onStart={vi.fn()}
    {...props}
  />
)

describe('ListingChipInput', () => {
  it('renders simple Korean paste guidance and listing chips', () => {
    const html = renderToStaticMarkup(renderChipInput())

    expect(html).toContain('매물 주소 넣기')
    expect(html).toContain(
      '복사한 내용을 그대로 붙여넣으세요. 매물 주소만 자동으로 찾습니다.'
    )
    expect(html).toContain('복사한 내용을 여기에 붙여넣으세요')
    expect(html).toContain('현대 메가트럭')
    expect(html).not.toContain('URL')
    expect(html).not.toContain('API')
    expect(html).not.toContain('파싱')
    expect(html).not.toContain('대기열')
  })

  it('shows ready, checking, and failed recovery states', () => {
    const html = renderToStaticMarkup(renderChipInput())

    expect(html).toContain('현대 메가트럭')
    expect(html).toContain('확인 완료')
    expect(html).toContain('매물 이름 찾는 중')
    expect(html).toContain('확인하지 못한 매물은 지우고 다시 붙여넣어 주세요.')
  })

  it('keeps the ready-count start label while disabled and hides remove buttons', () => {
    const html = renderToStaticMarkup(
      renderChipInput({ disabled: true, items: [readyItem] })
    )

    expect(html).toContain('확인된 1대 저장 시작')
    expect(html).not.toContain('매물 지우기: 현대 메가트럭')
  })

  it('can keep saved chips fixed while failed chips remain removable', () => {
    const html = renderToStaticMarkup(
      renderChipInput({
        canRemoveItem: (item) => item.status === 'failed',
        items: [
          {
            status: 'saved',
            id: 'listing-4',
            url: `${truckListing.url}&saved=1`,
            label: '저장된 매물',
            listing: truckListing,
            downloadedImages: 0,
            totalImages: 0,
            progress: 100,
          },
          items[2],
        ],
      })
    )

    expect(html).not.toContain('매물 지우기: 저장된 매물')
    expect(html).toContain('매물 지우기: 매물 이름을 확인하지 못했어요')
  })

  it('shows a plain duplicate message in Korean', () => {
    const html = renderToStaticMarkup(
      renderChipInput({ duplicateMessage: '이미 넣은 매물입니다.' })
    )

    expect(html).toContain('이미 넣은 매물입니다.')
  })

  it('intercepts pasted text and clears the draft field', () => {
    const onPasteText = vi.fn()

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    act(() => {
      root?.render(renderChipInput({ items: [], onPasteText }))
    })

    const textarea = container.querySelector(
      'textarea[placeholder="복사한 내용을 여기에 붙여넣으세요"]'
    )

    expect(textarea).toBeInstanceOf(HTMLTextAreaElement)

    const input = textarea as HTMLTextAreaElement

    act(() => {
      input.value = '임시 메모'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true })

    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => '붙여넣은 매물 주소',
      },
    })

    act(() => {
      input.dispatchEvent(pasteEvent)
    })

    expect(onPasteText).toHaveBeenCalledWith('붙여넣은 매물 주소')
    expect(input.value).toBe('')
  })
})
