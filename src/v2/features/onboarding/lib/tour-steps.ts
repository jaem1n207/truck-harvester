export interface TourStep {
  id: string
  anchorSelector: string
  fallbackSelector: string
  title: string
  description: string
}

export const tourSteps = [
  {
    id: 'addresses',
    anchorSelector: '[data-tour="url-input"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '매물 주소부터 넣어요',
    description:
      '복사한 매물 주소를 이 칸에 붙여넣으면, 매물 이름을 자동으로 찾아 보여줍니다.',
  },
  {
    id: 'save-folder',
    anchorSelector: '[data-tour="directory-selector"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '저장 위치를 먼저 골라요',
    description: '사진과 차량 정보가 차량번호별 폴더로 정리됩니다.',
  },
  {
    id: 'progress',
    anchorSelector: '[data-tour="processing-status"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '진행 상황을 바로 확인해요',
    description: '처리 중인 매물과 저장 완료된 매물을 한눈에 볼 수 있습니다.',
  },
] as const satisfies readonly TourStep[]

export function findTourAnchor(
  step: TourStep,
  root: Pick<Document, 'querySelector'> = document
) {
  return (
    root.querySelector(step.anchorSelector) ??
    root.querySelector(step.fallbackSelector)
  )
}
