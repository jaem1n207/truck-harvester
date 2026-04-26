export const v2Copy = {
  urlInput: {
    title: '매물 주소 붙여넣기',
    description: '한 줄에 하나씩 매물 상세 화면 주소를 넣어주세요.',
    label: '매물 주소',
    placeholder: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=...',
    submit: '가져오기 시작',
    errors: {
      empty: '가져올 매물 주소를 한 개 이상 넣어주세요.',
      invalid: '지원하는 매물 상세 화면 주소만 넣어주세요.',
    },
  },
  urlList: {
    title: '가져올 매물',
    empty: '아직 추가된 매물 주소가 없습니다.',
    remove: '목록에서 빼기',
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
  processingStatus: {
    title: '진행 상황',
    pending: '기다리는 중',
    parsing: '정보 확인 중',
    parsed: '정보 확인 완료',
    downloading: '사진 저장 중',
    downloaded: '저장 완료',
    failed: '확인이 필요합니다',
    skipped: '건너뜀',
    inProgress: '진행 중',
    done: '완료',
  },
  attentionPanel: {
    title: '주목 필요',
    description: '바로 처리되지 않은 매물만 모았습니다.',
    retry: '다시 시도',
    skip: '건너뛰기',
  },
} as const
