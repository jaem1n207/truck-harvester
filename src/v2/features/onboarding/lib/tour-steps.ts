export type TourExampleKind =
  | 'url-example'
  | 'folder-example'
  | 'progress-example'

export interface TourStep {
  id: string
  anchorSelector: string
  fallbackSelector: string
  title: string
  description: string
  exampleKind: TourExampleKind
}

export const tourSteps = [
  {
    id: 'addresses',
    anchorSelector: '[data-tour="url-input"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '매물 주소를 넣어요',
    description:
      '주소창에 있는 매물 주소를 처음부터 끝까지 복사해 붙여넣으세요. 복사한 내용 안에 매물 주소가 들어 있으면 자동으로 찾아요.',
    exampleKind: 'url-example',
  },
  {
    id: 'save-folder',
    anchorSelector: '[data-tour="directory-selector"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '저장할 곳을 고르세요',
    description: '사진과 차량 정보가 선택한 폴더 안에 차량별로 정리됩니다.',
    exampleKind: 'folder-example',
  },
  {
    id: 'progress',
    anchorSelector: '[data-tour="processing-status"]',
    fallbackSelector: '[data-tour="v2-page"]',
    title: '저장되는지 확인해요',
    description: '저장 중인 매물과 저장이 끝난 매물을 여기서 확인할 수 있어요.',
    exampleKind: 'progress-example',
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
