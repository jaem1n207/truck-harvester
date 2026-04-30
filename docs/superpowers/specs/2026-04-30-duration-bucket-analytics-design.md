# Duration Bucket Analytics Design

작성일: 2026-04-30

## 배경

Truck Harvester는 저장 완료 이벤트인 `save_completed`에 `duration_ms`를
밀리초 단위 숫자로 기록한다. 이 값은 사용자가 붙여넣기 후 미리보기와 저장을
거쳐 완료에 도달하기까지의 전체 체감 시간을 나타낸다.

사용자는 이 데이터를 바탕으로 평균 완료 시간과 초 단위 분포를 확인하려고 한다.
예를 들어 `6100`, `5100`, `5300`, `6420` 같은 원본 값에서 평균 몇 초가
걸렸는지, 1초대나 2초대 완료 작업이 전체 중 몇 퍼센트인지 알고 싶다.

## 참고 문서

- Umami Event data: https://docs.umami.is/docs/event-data
- Umami Tracker functions: https://docs.umami.is/docs/tracker-functions
- Umami Events API: https://docs.umami.is/docs/api/events
- Umami Cloud export: https://docs.umami.is/docs/cloud/export-data

## 목표

- `duration_ms` 원본 숫자를 유지해 평균, 중앙값, p95 같은 계산이 가능하게 한다.
- Umami Properties 화면에서 초 단위 분포를 바로 볼 수 있게 한다.
- 기존 개인정보 최소 수집 원칙을 유지한다.
- 사용자가 처리 시간을 "작업 완료 건" 기준으로 해석할 수 있게 한다.

## 확정 접근

기존 `duration_ms`를 유지하고, 같은 이벤트에 파생 속성
`duration_bucket`을 추가한다.

`duration_ms`는 정밀한 계산을 위한 원본값이다. `duration_bucket`은 Umami
대시보드에서 보기 쉬운 구간값이다. Umami Properties 화면은 고유 property
값별 카운트를 보여주므로, `duration_ms`만 있으면 `7095`, `4088`, `7171`처럼
모든 값이 흩어진다. 버킷을 함께 보내면 `04_4s`, `07_7s` 같은 값으로
분포를 바로 확인할 수 있다.

## 이벤트 속성

### 유지: `duration_ms`

- 타입: number
- 단위: milliseconds
- 예: `6100`, `5100`, `5300`, `6420`
- 용도: 평균, 중앙값, p95, 세부 분석

### 추가: `duration_bucket`

- 타입: string
- 단위: 초대 구간
- 예: `01_1s`, `02_2s`, `06_6s`, `10_10s_plus`
- 용도: Umami Properties 화면에서 분포 확인

버킷 규칙:

- `0 <= duration_ms < 1000`: `00_under_1s`
- `1000 <= duration_ms < 2000`: `01_1s`
- `2000 <= duration_ms < 3000`: `02_2s`
- 같은 방식으로 `09_9s`까지 기록한다.
- `duration_ms >= 10000`: `10_10s_plus`

`duration_ms`가 음수, 무한대, 숫자가 아닌 값이면 이벤트 전송 전 0 이상
정수로 정규화한다. 현재 workflow analytics의 duration 계산은 이미 0 이상
반올림값을 만든다.

## 분석 방법

### 평균 완료 시간

평균은 `duration_ms` 원본값으로 계산한다.

```text
평균 초 = (duration_ms 합계 / save_completed 이벤트 수) / 1000
```

예:

```text
values = 6100, 5100, 5300, 6420
평균 = (6100 + 5100 + 5300 + 6420) / 4 / 1000
     = 5.73초
```

Umami 기본 Properties 화면은 고유값 분포에 강하므로 평균 계산에는 적합하지
않다. 평균과 percentile은 Umami export CSV나 Events API를 통해 원본
`duration_ms`를 가져와 계산한다.

### 초대별 분포

분포는 `duration_bucket`으로 확인한다.

```text
N초대 비율 = N초대 save_completed 이벤트 수 / 전체 save_completed 이벤트 수 * 100
```

예:

```text
values = 6100, 5100, 5300, 6420
05_5s = 2건 = 50%
06_6s = 2건 = 50%
01_1s = 0건 = 0%
02_2s = 0건 = 0%
```

Umami Events 화면에서 `save_completed` 이벤트를 선택하고 Properties 탭에서
`duration_bucket`을 선택하면 버킷별 카운트와 비율을 확인한다.

## 해석 기준

이 지표는 "사용자 비율"이 아니라 "저장 완료 작업 건 비율"이다. 같은 직원이
하루에 10번 저장을 완료하면 10건으로 집계된다.

사용자별 분포를 보려면 안정적인 사용자 식별자가 필요하지만, 현재 제품 분석
정책은 사용자 식별자 수집을 목표로 하지 않는다. Truck Harvester의 운영
질문에는 작업 완료 건 기준 분포가 더 적합하다.

## 구현 경계

- `duration_bucket`은 `save_completed`에 우선 추가한다.
- 같은 분석이 필요하면 `preview_completed`, `save_failed`에도 같은 helper를
  재사용할 수 있게 만든다.
- 성공 매물 URL, 차량번호, 차명은 계속 수집하지 않는다.
- 실패 매물 상세 수집 정책은 기존 `listing_failed` 경계를 유지한다.
- UI copy나 사용자 작업 흐름은 바꾸지 않는다.

## 테스트 계획

- `duration_ms`가 `duration_bucket`으로 올바르게 변환되는지 단위 테스트를 둔다.
- 경계값을 테스트한다: `0`, `999`, `1000`, `1999`, `2000`, `9999`,
  `10000`.
- `save_completed` payload에 `duration_ms`와 `duration_bucket`이 함께 들어가는지
  검증한다.
- 기존 analytics fallback 동작을 유지한다: `window.umami`가 없거나
  `track()`이 예외를 던져도 앱 작업은 실패하지 않는다.

## 범위 밖

- 사용자 식별자 수집
- 별도 관리자 대시보드 구현
- Umami 자가 호스팅
- 평균 값을 앱 UI에 표시
- 이미지별 다운로드 시간 계측

## 승인된 구현 방향

1. `duration_ms` 원본 밀리초 정수를 계속 수집한다.
2. `duration_bucket` 문자열 속성을 추가한다.
3. 평균과 percentile은 export/API 기반으로 계산한다.
4. Umami Properties 화면에서는 `duration_bucket`으로 초대별 분포를 확인한다.
