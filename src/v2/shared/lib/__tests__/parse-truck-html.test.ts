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
        <dd><strong class="number">2020</strong>년식</dd>
        <dd><strong class="red number">150,000</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      <p><font><span><b><span>차명: 2020년 현대 마이티 냉동탑차</span></b></span></font></p>
      ▶ 추가장착 옵션 :: 냉동탑, 후방카메라, 블랙박스<br />
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

describe('parseTruckHtml', () => {
  it('extracts truck listing fields using the legacy selectors', () => {
    const listing = parseTruckHtml(fullHtml, detailUrl)

    expect(listing).toEqual({
      url: detailUrl,
      vname: '현대 마이티',
      vehicleName: '2020년 현대 마이티 냉동탑차',
      vnumber: '12가3456',
      price: {
        raw: 3550,
        rawWon: 35500000,
        label: '3,550만원',
        compactLabel: '3.6천만',
      },
      year: '2020',
      mileage: '150,000km',
      options: '냉동탑 / 후방카메라 / 블랙박스',
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
})
