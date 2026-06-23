import { type SmartStoreTable, type TruckListing } from '@/v2/entities/truck'

import { buildVehicleImageFileName } from './filename'

const missingSmartStoreInfoLabel = '정보 없음'

function buildFallbackSmartStoreTable(truck: TruckListing): SmartStoreTable {
  return {
    vehicleName: truck.vehicleName,
    registrationLabel: truck.year,
    mileage: truck.mileage,
    vehicleNumber: truck.vnumber,
    upperInfo: missingSmartStoreInfoLabel,
    lowerInfo: missingSmartStoreInfoLabel,
    hasVehicleInfo: false,
  }
}

function buildSmartStoreTableDetails(table: SmartStoreTable) {
  const baseRows = [
    `  차명 : ${table.vehicleName}`,
    `  연식 : ${table.registrationLabel}`,
    `  주행거리 : ${table.mileage}`,
    `  차량번호 : ${table.vehicleNumber}`,
  ]

  if (!table.hasVehicleInfo) {
    return [...baseRows, `  차량정보 : ${missingSmartStoreInfoLabel}`].join(
      '\n'
    )
  }

  return [
    ...baseRows,
    '  차량정보 :',
    `    상부 : ${table.upperInfo}`,
    `    하부 : ${table.lowerInfo}`,
  ].join('\n')
}

export function buildTruckTextContent(truck: TruckListing) {
  const smartStoreDetails = buildSmartStoreTableDetails(
    truck.smartStoreTable ?? buildFallbackSmartStoreTable(truck)
  )
  const imageUrls =
    truck.images.length > 0
      ? truck.images
          .map((_, index) => `#사진:${buildVehicleImageFileName(index)}`)
          .join('\n')
      : '이미지 없음'

  return `${truck.vname} 매매 가격 시세
${truck.price.rawWon}
생활/건강,공구,운반용품

${truck.vname} 매매 가격 시세



차종 :  ${truck.vname}

차명 :  ${truck.vehicleName}

차량번호 :  ${truck.vnumber}

연식 :  ${truck.year}

주행거리 :  ${truck.mileage}

기타사항 :
${smartStoreDetails}




가격 :  ${truck.price.label}





화물차, 특장차를 전문으로 매매하는 오픈매장으로

충분한 상담을 통해 용도에 딱 맞는 차량을 권해드리고 있습니다.

최고가 매입, 매매 /전국 어디든 출장 매입 가능!!



언제든지 문의 주시면 최선을 다해 상담하겠습니다.
상담문의 010-4082-8945 트럭판매왕

${imageUrls}`
}
