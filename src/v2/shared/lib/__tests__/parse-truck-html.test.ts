import { describe, expect, it } from 'vitest'

import { parseTruckHtml } from '../parse-truck-html'

const detailUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

const fullHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">현대 마이티</p>
    <p class="vnumber">12가3456</p>
    <p class="vcash">가격 <span class="red">3,550</span>만원</p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2023</strong>년형 | <span class="number">20231117</span> 최초등록</dd>
        <dt>주행거리</dt>
        <dd><strong class="red number">159,600</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      ▶ 추가장착 옵션 :: 1.3톤활어운반차, 포터2, 오토미션, 바로특장, 1.3톤인증차, 1인신조, 무사고, 액산병 보유<br /><br /><br />
      ▶ 상세설명 ::
      <p><font><span><b><span>·&nbsp;차명: 포터2 1.3톤활어운반차</span></b></span></font></p>
      <p><b><span>·&nbsp;</span></b><font><span><b><span>상부: 인증차(</span></b></span><span><b>바로1.3톤활어운반차</b></span></font><b><span>), 액산병 보유</span></b></p>
      <p><b><span>·&nbsp;</span></b><font><span><b><span>하부: 1인신조, 무사고, 오토미션</span></b></span></font></p>
    </div>
    <div class="sumnail">
      <ul>
        <li><img onmouseover="changeImg('https://img.example.com/one.jpg')" src="https://img.example.com/one_TH.jpg" /></li>
        <li><img onmouseover="changeImg('https://img.example.com/two.jpg')" src="https://img.example.com/two_TH.jpg" /></li>
        <li><img onmouseover="changeImg('/Blank_Photo_S.gif')" src="/Blank_Photo_S.gif" /></li>
      </ul>
      <img src="https://img.example.com/three.jpg" />
      <img src="https://img.example.com/three.jpg" />
    </div>
    <dl>
      <dt>성능번호</dt>
      <dd>
        <a href="http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3" class="pc_btn_view"
          >성능점검보기(클릭)</a
        >
      </dd>
    </dl>
  </body>
</html>
`

const lowercasePerformanceUrlHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">현대 파워트럭</p>
    <p class="vnumber">56다5678</p>
    <p class="vcash"><span class="red">2,900</span>만원</p>
    <dl>
      <dt>성능번호</dt>
      <dd>
        <a href="http://autocafe.co.kr/ASSO/carcheck_form_my.asp?OnCarNo=4" class="pc_btn_view"
          >성능점검보기(클릭)</a
        >
      </dd>
    </dl>
  </body>
</html>
`

const javascriptPerformanceUrlHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">대우 스카니아</p>
    <p class="vnumber">78라1234</p>
    <p class="vcash"><span class="red">1,200</span>만원</p>
    <dl>
      <dt>성능번호</dt>
      <dd>
        <a href="javascript:alert(1)">성능점검보기(클릭)</a>
      </dd>
    </dl>
  </body>
</html>
`

const sparseHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">기아 봉고</p>
    <p class="vnumber">34나5678</p>
    <p class="vcash"><span class="red">900</span></p>
  </body>
</html>
`

const emptyDetailHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">냉동탑 5톤이상</p>
    <p class="vnumber">91누5384</p>
    <p class="vcash"><span class="red">12,500</span>만원</p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2021</strong>년형 | <span class="number">20210823</span> 최초등록</dd>
        <dt>주행거리</dt>
        <dd><strong class="red number">363,313</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      ▶ 추가장착 옵션 :: <br /><br /><br />
      ▶ 상세설명 ::
      <p><font><span><b><span>·&nbsp;차명:</span></b></span></font></p>
      <p><b><span>·&nbsp;</span></b><font><span><b><span>상부:</span></b></span></font></p>
      <p><b><span>·&nbsp;</span></b><font><span><b><span>하부:</span></b></span></font></p>
    </div>
  </body>
</html>
`

const partialVehicleInfoHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">현대 포터2</p>
    <p class="vnumber">88다8888</p>
    <p class="vcash"><span class="red">2,000</span>만원</p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2022</strong>년형 | <span class="number">20220501</span> 최초등록</dd>
        <dt>주행거리</dt>
        <dd><strong class="red number">50,000</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      ▶ 상세설명 ::
      <p><span>· 차명: 포터2 특장차</span></p>
      <p><span>· 상부: 냉동탑</span></p>
      <p><span>· 하부:</span></p>
    </div>
  </body>
</html>
`

const multilineVehicleInfoHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">기아 봉고3</p>
    <p class="vnumber">90로1234</p>
    <p class="vcash"><span class="red">4,300</span>만원</p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2023</strong>년형 | <span class="number">20230210</span> 최초등록</dd>
        <dt>주행거리</dt>
        <dd><strong class="red number">91,000</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      ▶ 상세설명 ::
      <p><span>· 차명: 봉고3 1톤930바가지차</span></p>
      <p><span>· 상부: 동해930, 인버터,유/무선리모컨, 작업다이, 공구함</span></p>
      <p><span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;동해기계항공 용인 서비스센터에서 점검 완료</span></p>
      <p><span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;작업 높이: 8.9m, 작업 반경: 6.4m</span></p>
      <p><span>· 하부: 오토미션, 133마력, 요소수 타입, 실내클리닝 완료</span></p>
      <p><span>- - - - - - - - - - - - - - - - - - - - -</span></p>
      <p><span>안녕하세요. 트럭판매왕입니다.</span></p>
    </div>
  </body>
</html>
`

const invalidRegistrationHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">기아 봉고</p>
    <p class="vnumber">34나5678</p>
    <p class="vcash"><span class="red">900</span></p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2020</strong>년형 | <span class="number">20201340</span> 최초등록</dd>
      </dl>
    </div>
  </body>
</html>
`

describe('parseTruckHtml', () => {
  it('extracts truck listing fields using the legacy selectors', () => {
    const listing = parseTruckHtml(fullHtml, detailUrl)

    expect(listing).toEqual({
      url: detailUrl,
      vname: '현대 마이티',
      vehicleName: '포터2 1.3톤활어운반차',
      vnumber: '12가3456',
      price: {
        raw: 3550,
        rawWon: 35500000,
        label: '3,550만원',
        compactLabel: '3.6천만',
      },
      year: '2023',
      mileage: '159,600km',
      options:
        '1.3톤활어운반차 / 포터2 / 오토미션 / 바로특장 / 1.3톤인증차 / 1인신조 / 무사고 / 액산병 보유',
      smartStoreTable: {
        vehicleName: '포터2 1.3톤활어운반차',
        registrationLabel: '2023년 11월 등록',
        mileage: '159,600km',
        vehicleNumber: '12가3456',
        upperInfo: '인증차(바로1.3톤활어운반차), 액산병 보유',
        lowerInfo: '1인신조, 무사고, 오토미션',
        hasVehicleInfo: true,
      },
      performanceCheckUrl:
        'http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=3',
      images: [
        'https://img.example.com/one.jpg',
        'https://img.example.com/two.jpg',
        'https://img.example.com/three.jpg',
      ],
    })
  })

  it('keeps recoverable fallback copy when optional selectors are missing', () => {
    const listing = parseTruckHtml(sparseHtml, detailUrl)

    expect(listing).toMatchObject({
      url: detailUrl,
      vname: '기아 봉고',
      vehicleName: '기아 봉고',
      vnumber: '34나5678',
      price: {
        raw: 900,
        rawWon: 9000000,
        label: '900만원',
        compactLabel: '900만원',
      },
      year: '연식 정보 없음',
      mileage: '주행거리 정보 없음',
      options: '기타사항 정보 없음',
      images: [],
    })
  })

  it('leaves performanceCheckUrl empty when the listing has no check link', () => {
    const listing = parseTruckHtml(sparseHtml, detailUrl)

    expect(listing.performanceCheckUrl).toBeUndefined()
  })

  it('falls back when detail labels are present but empty', () => {
    const listing = parseTruckHtml(emptyDetailHtml, detailUrl)

    expect(listing.smartStoreTable).toEqual({
      vehicleName: '냉동탑 5톤이상',
      registrationLabel: '2021년 8월 등록',
      mileage: '363,313km',
      vehicleNumber: '91누5384',
      upperInfo: '정보 없음',
      lowerInfo: '정보 없음',
      hasVehicleInfo: false,
    })
  })

  it('keeps both upper and lower rows when only one vehicle info value exists', () => {
    const listing = parseTruckHtml(partialVehicleInfoHtml, detailUrl)

    expect(listing.smartStoreTable).toEqual({
      vehicleName: '포터2 특장차',
      registrationLabel: '2022년 5월 등록',
      mileage: '50,000km',
      vehicleNumber: '88다8888',
      upperInfo: '냉동탑',
      lowerInfo: '정보 없음',
      hasVehicleInfo: true,
    })
  })

  it('keeps continuation paragraphs inside upper and lower vehicle info fields', () => {
    const listing = parseTruckHtml(multilineVehicleInfoHtml, detailUrl)

    expect(listing.smartStoreTable).toMatchObject({
      upperInfo:
        '동해930, 인버터,유/무선리모컨, 작업다이, 공구함\n동해기계항공 용인 서비스센터에서 점검 완료\n작업 높이: 8.9m, 작업 반경: 6.4m',
      lowerInfo: '오토미션, 133마력, 요소수 타입, 실내클리닝 완료',
      hasVehicleInfo: true,
    })
  })

  it('uses the existing year fallback when the initial registration date is invalid', () => {
    const listing = parseTruckHtml(invalidRegistrationHtml, detailUrl)

    expect(listing.smartStoreTable?.registrationLabel).toBe('2020')
  })

  it('matches performance check URLs case-insensitively from href', () => {
    const listing = parseTruckHtml(lowercasePerformanceUrlHtml, detailUrl)

    expect(listing.performanceCheckUrl).toBe(
      'http://autocafe.co.kr/ASSO/carcheck_form_my.asp?OnCarNo=4'
    )
  })

  it('does not extract javascript: URLs for performance check links', () => {
    const listing = parseTruckHtml(javascriptPerformanceUrlHtml, detailUrl)

    expect(listing.performanceCheckUrl).toBeUndefined()
  })
})
