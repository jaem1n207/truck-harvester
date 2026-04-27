import { load } from 'cheerio'

import { truckListingSchema, type TruckListing } from '@/v2/entities/truck'

function buildCompactPriceLabel(priceRaw: number) {
  const priceLabel = `${priceRaw.toLocaleString()}만원`

  if (priceRaw >= 10000) {
    const billions = Math.floor(priceRaw / 10000)
    const remainder = priceRaw % 10000

    if (remainder === 0) {
      return `${billions}억`
    }

    const thousands = Math.round(remainder / 1000)
    return thousands === 0 ? `${billions}억` : `${billions}.${thousands}억`
  }

  if (priceRaw >= 1000) {
    const thousands = Math.floor(priceRaw / 1000)
    const hundreds = Math.round((priceRaw % 1000) / 100)
    return hundreds === 0 ? `${thousands}천만` : `${thousands}.${hundreds}천만`
  }

  return priceLabel
}

export function parseTruckHtml(html: string, url: string): TruckListing {
  const $ = load(html)
  const vname = $('p.vname').text().trim() || '차명 정보 없음'
  const vnumber = $('p.vnumber').text().trim() || '차량번호 정보 없음'
  const priceRaw =
    Number.parseInt(
      $('p.vcash > span.red').first().text().trim().replace(/[,\s]/g, ''),
      10
    ) || 0

  let year = '연식 정보 없음'
  const yearText = $('.car-detail dl dd')
    .first()
    .find('strong.number')
    .first()
    .text()
    .trim()
  if (/^\d{4}$/.test(yearText)) {
    year = yearText
  }

  let mileage = '주행거리 정보 없음'
  $('.car-detail dl dd').each((_, element) => {
    const ddElement = $(element)
    const mileageText = ddElement
      .find('strong.red.number')
      .first()
      .text()
      .trim()

    if (
      mileageText &&
      ddElement.text().includes('km') &&
      mileage === '주행거리 정보 없음'
    ) {
      mileage = `${mileageText}km`
    }
  })

  let extractedVehicleName = ''
  $('.vcontent p font span b span').each((_, element) => {
    const spanText = $(element).text().trim()

    if (spanText.startsWith('차명:') && !extractedVehicleName) {
      extractedVehicleName = spanText.replace('차명:', '').trim()
    }
  })

  let options = '기타사항 정보 없음'
  const vcontentHtml = $('.vcontent').html()
  const optionsMatch = vcontentHtml?.match(
    /▶\s*추가장착\s*옵션\s*::\s*([^<]*?)(?=<br|$)/i
  )
  const optionsText = optionsMatch?.[1]?.trim()
  if (optionsText) {
    options = optionsText.replace(/,\s*/g, ' / ')
  }

  const images: string[] = []

  $('.sumnail ul li img[onmouseover*="changeImg"]').each((_, element) => {
    const onMouseOver = $(element).attr('onmouseover')
    const imageUrl = onMouseOver?.match(/changeImg\(['"](.*?)['"]\)/)?.[1]

    if (imageUrl && !imageUrl.toLowerCase().includes('blank')) {
      images.push(imageUrl)
    }
  })

  $('.sumnail img').each((_, element) => {
    const src = $(element).attr('src')

    if (src && !src.includes('_TH') && !src.toLowerCase().includes('blank')) {
      images.push(src)
    }
  })

  return truckListingSchema.parse({
    url,
    vname,
    vehicleName: extractedVehicleName || vname,
    vnumber,
    price: {
      raw: priceRaw,
      rawWon: priceRaw * 10000,
      label: `${priceRaw.toLocaleString()}만원`,
      compactLabel: buildCompactPriceLabel(priceRaw),
    },
    year,
    mileage,
    options,
    images: Array.from(new Set(images)),
  })
}
