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
    description: '한 줄에 하나씩 붙여넣으면 중복은 자동으로 정리됩니다.',
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
  {
    id: 'attention',
    anchorSelector: '[data-tour="attention-panel"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '막힌 매물만 따로 살펴요',
    description:
      '다시 시도하거나 건너뛰면 나머지 작업을 계속 마칠 수 있습니다.',
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
