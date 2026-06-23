import { load } from 'cheerio'

import {
  truckListingSchema,
  type SmartStoreTable,
  type TruckListing,
} from '@/v2/entities/truck'

function normalizeOptionalUrl(href: string | undefined, baseUrl: string) {
  if (!href || href.trim().length === 0) {
    return undefined
  }

  try {
    const normalized = new URL(href, baseUrl)

    if (!/^https?:$/.test(normalized.protocol)) {
      return undefined
    }

    return normalized.toString()
  } catch {
    return undefined
  }
}

function extractPerformanceCheckUrl(
  $: ReturnType<typeof load>,
  listingUrl: string
) {
  const candidate = $('a')
    .toArray()
    .map((element) => {
      const link = $(element)
      const text = link.text().replace(/\s+/g, '')
      const href = link.attr('href')

      return {
        href,
        text,
      }
    })
    .find(
      ({ href, text }) =>
        text.includes('성능점검보기') ||
        href?.toLowerCase().includes('carcheck_form') ||
        href?.toLowerCase().includes('checkpaper')
    )

  return normalizeOptionalUrl(candidate?.href, listingUrl)
}

const missingSmartStoreInfoLabel = '정보 없음'

function normalizeContentText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/^[\s·•]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCarDetailText($: ReturnType<typeof load>, label: string) {
  let detailText: string | undefined

  $('.car-detail dl dt').each((_, element) => {
    if (detailText) {
      return
    }

    const term = normalizeContentText($(element).text())

    if (term === label) {
      detailText = normalizeContentText($(element).next('dd').text())
    }
  })

  return detailText
}

function formatInitialRegistrationLabel(value: string | undefined) {
  const compactDate = value?.match(/(\d{8})\s*최초등록/)?.[1]

  if (!compactDate) {
    return undefined
  }

  const year = Number.parseInt(compactDate.slice(0, 4), 10)
  const month = Number.parseInt(compactDate.slice(4, 6), 10)
  const day = Number.parseInt(compactDate.slice(6, 8), 10)
  const parsedDate = new Date(year, month - 1, day)

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }

  return `${year}년 ${month}월 등록`
}

function extractVcontentField($: ReturnType<typeof load>, label: string) {
  const fieldPattern = new RegExp(`^${label}\\s*:\\s*(.*)$`)

  for (const element of $('.vcontent p').toArray()) {
    const normalizedText = normalizeContentText($(element).text())
    const match = normalizedText.match(fieldPattern)
    const value = normalizeContentText(match?.[1] ?? '')

    if (value) {
      return value
    }
  }

  return undefined
}

function buildSmartStoreTable({
  $,
  fallbackMileage,
  fallbackVehicleName,
  fallbackVehicleNumber,
  fallbackYear,
}: {
  $: ReturnType<typeof load>
  fallbackMileage: string
  fallbackVehicleName: string
  fallbackVehicleNumber: string
  fallbackYear: string
}): SmartStoreTable {
  const upperInfo = extractVcontentField($, '상부')
  const lowerInfo = extractVcontentField($, '하부')

  return {
    vehicleName: extractVcontentField($, '차명') ?? fallbackVehicleName,
    registrationLabel:
      formatInitialRegistrationLabel(getCarDetailText($, '년형 | 등록')) ??
      fallbackYear,
    mileage: fallbackMileage,
    vehicleNumber: fallbackVehicleNumber,
    upperInfo: upperInfo ?? missingSmartStoreInfoLabel,
    lowerInfo: lowerInfo ?? missingSmartStoreInfoLabel,
    hasVehicleInfo: Boolean(upperInfo || lowerInfo),
  }
}

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

  const extractedVehicleName = extractVcontentField($, '차명')

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
    performanceCheckUrl: extractPerformanceCheckUrl($, url),
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
    smartStoreTable: buildSmartStoreTable({
      $,
      fallbackMileage: mileage,
      fallbackVehicleName: extractedVehicleName || vname,
      fallbackVehicleNumber: vnumber,
      fallbackYear: year,
    }),
    images: Array.from(new Set(images)),
  })
}
