import { type TruckListing } from '@/v2/entities/truck'

import { buildImageFileName } from './filename'

export function buildTruckTextContent(truck: TruckListing) {
  const imageUrls =
    truck.images.length > 0
      ? truck.images
          .map((_, index) => `#사진:${buildImageFileName(index)}`)
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

기타사항 :  ${truck.options}




가격 :  ${truck.price.label}





화물차, 특장차를 전문으로 매매하는 오픈매장으로

충분한 상담을 통해 용도에 딱 맞는 차량을 권해드리고 있습니다.

최고가 매입, 매매 /전국 어디든 출장 매입 가능!!



언제든지 문의 주시면 최선을 다해 상담하겠습니다.
상담문의 010-4082-8945 트럭판매왕

${imageUrls}`
}
