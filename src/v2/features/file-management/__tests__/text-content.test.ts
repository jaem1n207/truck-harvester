import { describe, expect, it } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { buildTruckTextContent } from '../text-content'

const listing: TruckListing = {
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
  vname: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
  vehicleName: '포터2 1.3톤활어운반차',
  vnumber: '822수2698',
  price: {
    raw: 2850,
    rawWon: 28500000,
    label: '2,850만원',
    compactLabel: '2.9천만',
  },
  year: '2023',
  mileage: '159,600km',
  options:
    '1.3톤활어운반차 / 포터2 / 오토미션 / 바로특장 / 1.3톤인증차 / 1인신조 / 무사고 / 액산병 보유',
  smartStoreTable: {
    vehicleName: '포터2 1.3톤활어운반차',
    registrationLabel: '2023년 11월 등록',
    mileage: '159,600km',
    vehicleNumber: '822수2698',
    upperInfo: '인증차(바로1.3톤활어운반차), 액산병 보유',
    lowerInfo: '1인신조, 무사고, 오토미션',
    hasVehicleInfo: true,
  },
  images: ['https://img.example.com/one.jpg'],
}

describe('buildTruckTextContent', () => {
  it('renders an indented smart store table block inside 기타사항', () => {
    const content = buildTruckTextContent(listing)

    expect(content).toContain(`기타사항 :
  차명 : 포터2 1.3톤활어운반차
  연식 : 2023년 11월 등록
  주행거리 : 159,600km
  차량번호 : 822수2698
  차량정보 :
    상부 : 인증차(바로1.3톤활어운반차), 액산병 보유
    하부 : 1인신조, 무사고, 오토미션`)
    expect(content).not.toContain('기타사항 :  1.3톤활어운반차')
  })

  it('renders vehicle info as one line when upper and lower details are empty', () => {
    const content = buildTruckTextContent({
      ...listing,
      smartStoreTable: {
        vehicleName: '냉동탑 5톤이상',
        registrationLabel: '2021년 8월 등록',
        mileage: '363,313km',
        vehicleNumber: '91누5384',
        upperInfo: '정보 없음',
        lowerInfo: '정보 없음',
        hasVehicleInfo: false,
      },
    })

    expect(content).toContain(`기타사항 :
  차명 : 냉동탑 5톤이상
  연식 : 2021년 8월 등록
  주행거리 : 363,313km
  차량번호 : 91누5384
  차량정보 : 정보 없음`)
    expect(content).not.toContain('추가장착 옵션 : 정보 없음')
  })

  it('keeps both upper and lower rows when only one value is present', () => {
    const content = buildTruckTextContent({
      ...listing,
      smartStoreTable: {
        vehicleName: '포터2 특장차',
        registrationLabel: '2023년 11월 등록',
        mileage: '159,600km',
        vehicleNumber: '822수2698',
        upperInfo: '냉동탑',
        lowerInfo: '정보 없음',
        hasVehicleInfo: true,
      },
    })

    expect(content).toContain(`  차량정보 :
    상부 : 냉동탑
    하부 : 정보 없음`)
  })

  it('builds a safe table fallback when a legacy listing lacks smartStoreTable', () => {
    const { smartStoreTable: _unused, ...legacyListing } = listing
    const content = buildTruckTextContent(legacyListing)

    expect(content).toContain(`기타사항 :
  차명 : 포터2 1.3톤활어운반차
  연식 : 2023
  주행거리 : 159,600km
  차량번호 : 822수2698
  차량정보 : 정보 없음`)
  })
})
