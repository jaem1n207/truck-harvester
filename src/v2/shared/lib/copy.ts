export const v2Copy = {
  urlInput: {
    title: '매물 주소 넣기',
    description:
      '복사한 내용을 그대로 붙여넣으세요. 매물 주소만 자동으로 찾습니다.',
    label: '매물 주소',
    placeholder: '복사한 내용을 여기에 붙여넣으세요',
    submit: '매물 확인 시작',
    errors: {
      empty: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
      invalid: '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.',
    },
  },
  directorySelector: {
    title: '저장 폴더 선택',
    explainer:
      '사진과 차량 정보가 차량번호별 폴더로 정리됩니다. 저장할 위치를 먼저 골라주세요.',
    choose: '저장 폴더 고르기',
    unsupportedTitle: '압축 파일로 저장됩니다',
    unsupportedDescription:
      '이 브라우저에서는 폴더를 직접 고를 수 없어, 모든 파일을 압축 파일로 내려받습니다.',
  },
} as const
