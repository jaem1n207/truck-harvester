# 성능점검기록부 저장 analytics 설계

작성일: 2026-06-25

## 배경

Truck Harvester는 매물 저장 시 차량 이미지, 성능점검기록부 JPG, 원고를
차량별 폴더나 ZIP으로 저장한다. 성능점검기록부는 매물 parser가 찾은
`performanceCheckUrl`이 있을 때만 저장을 시도하며, 저장하지 못해도 차량
이미지와 원고 저장은 성공으로 처리한다.

현재 analytics는 batch 단위의 붙여넣기, 미리보기, 저장 funnel을 기록한다.
성능점검기록부 저장 결과는 `TruckSaveResult`와 prepared listing state에는
남지만, Umami aggregate event에는 반영되지 않는다. 따라서 운영자가 "저장은
성공했는데 성능점검기록부가 얼마나 저장됐는지"를 batch 수준에서 볼 수 없다.

## 목표

- 저장 완료 batch analytics에 성능점검기록부 aggregate 결과를 추가한다.
- 성능점검기록부 저장 실패를 차량 저장 실패로 기록하지 않는다.
- `not_requested`와 `missing`을 analytics에서 분리한다.
- raw CheckPaper URL, 차량별 성능점검기록부 URL, 원본 문서 내용은 보내지
  않는다.
- UI 컴포넌트가 `window.umami`나 analytics payload field를 직접 알지 않는
  기존 경계를 유지한다.

## 비목표

- 새 Umami event name을 추가하지 않는다.
- 성능점검기록부 missing을 `listing_failed`나 `save_failed`의 개별 실패로
  기록하지 않는다.
- 저장 폴더 구조, 완료 요약 UI, CheckPaper renderer 동작을 바꾸지 않는다.
- 기존 preview analytics나 failed-listing diagnostic 수집 범위를 넓히지
  않는다.
- 새 `listing_count` field를 만들지 않는다. 현재 batch contract의
  `url_count`, `unique_url_count`, `ready_count`를 그대로 사용한다.

## 확정 접근

기존 batch save event payload를 확장한다.

`runSaveWorkflow`는 directory 저장과 ZIP fallback에서 받은 `TruckSaveResult`를
listing id와 연결해 `workflow-analytics`의 `saveSettled` fact로 전달한다.
`workflow-analytics`는 batch group별로 저장 결과를 집계하고, 기존
`trackSaveCompleted` 또는 `trackSaveFailed` input에 성능점검기록부 aggregate
field를 추가한다.

이 방식은 현재 "business fact -> workflow analytics adapter -> shared
analytics transport" 경계를 유지한다. `src/v2/shared/lib/analytics.ts`만 concrete
Umami payload key를 알고, UI와 save workflow는 Umami event name을 알지 않는다.

## Payload contract

`save_completed`와 batch-level `save_failed` payload에 아래 optional aggregate
fields를 추가한다.

```text
performance_check_requested_count
performance_check_saved_count
performance_check_missing_count
performance_check_image_count
```

기존 batch fields는 유지한다.

```text
batch_id
url_count
unique_url_count
ready_count
invalid_count
preview_failed_count
saved_count
save_failed_count
duration_ms
duration_bucket
save_method
filesystem_supported
notification_enabled
```

`duration_bucket`은 기존처럼 `save_completed`에서만 붙인다. 성능점검기록부
aggregate fields는 저장 결과를 알 수 있는 settled event에만 붙이고,
`batch_started`, `preview_completed`, `save_started`, `listing_failed`에는 붙이지
않는다.

## Counting rules

성능점검기록부 count는 batch group 안의 저장 대상 ready listings를 기준으로
계산한다.

- `performance_check_requested_count`: `listing.performanceCheckUrl`이 비어 있지
  않은 저장 대상 수.
- `performance_check_saved_count`: 저장 결과가
  `performanceCheckStatus === 'saved'`인 수.
- `performance_check_missing_count`: `listing.performanceCheckUrl`이 있었고 저장
  결과가 `performanceCheckStatus === 'missing'`인 수.
- `performance_check_image_count`: 저장 결과의
  `performanceCheckImageCount` 합계.

`performanceCheckStatus === 'not_requested'`는 missing에 포함하지 않는다. 매물에
성능점검기록부 링크가 없었던 차량과 링크가 있었지만 저장하지 못한 차량은 원인이
다르므로, analytics에서도 섞지 않는다.

저장 자체가 실패한 차량은 저장 결과가 없을 수 있다. 이 경우 requested count는
listing의 `performanceCheckUrl`로 계산하지만, saved/image count에는 반영하지
않는다. 성능점검기록부 때문에 차량 저장 실패가 발생한 것처럼 기록하지 않는다.

## Data flow

```text
save-workflow
  -> saveTruckToDirectory() or downloadTruckZip()
  -> collect TruckSaveResult by prepared listing id
  -> tracker.saveSettled({ savedItemIds, saveResultsByItemId })
  -> workflow-analytics groups listings by original preview batch
  -> workflow-analytics computes performance-check aggregates per group
  -> shared analytics transport emits save_completed or batch-level save_failed
```

Directory 저장은 listing 하나를 저장할 때마다 `TruckSaveResult`를 바로 item id에
연결한다. ZIP fallback은 `sourceUrl`로 반환 결과를 matching한 뒤, matched result를
item id에 연결한다. 기존 ZIP mismatch 처리처럼 matching되지 않은 item은 차량 저장
실패로 처리하고, 성능점검기록부 saved/image count에는 포함하지 않는다.

## Privacy and safety

성능점검기록부 analytics는 count만 보낸다. 보내지 않는 값은 명시적으로 다음과
같다.

- raw CheckPaper URL
- 차량별 `performanceCheckUrl`
- CheckPaper HTML, PDF, JPG bytes, 문서 텍스트
- renderer provider, redirect URL, asset URL

기존 failed-listing diagnostic 예외는 그대로 유지한다. 즉 개별 URL, 차량번호,
차명, 이미지 수는 preview/save listing failure event에서만 허용되며,
성능점검기록부 missing은 이 event를 만들지 않는다.

Analytics 호출 실패는 기존 transport처럼 사용자 저장 흐름을 중단하지 않는다.

## Error handling

- 성능점검기록부 URL이 없으면 requested count에 포함하지 않는다.
- URL이 있었지만 capture 결과가 없거나 renderer가 실패해 `missing`이 되면
  missing count에 포함한다.
- 성능점검기록부가 missing이어도 `savedItemIds`에는 영향을 주지 않는다.
- 차량 이미지나 원고 저장 실패처럼 차량 저장 자체가 실패한 경우에만 기존
  `saveListingFailed` 흐름을 사용한다.
- Abort 이후에는 기존처럼 save settlement analytics를 보내지 않는다.

## Testing plan

- `src/v2/shared/lib/__tests__/analytics.test.ts`
  - `toBatchEventData`가 성능점검기록부 aggregate fields를 포함한다.
  - aggregate payload에 raw URL, 차량번호, 차명, 문서 내용 field가 섞이지
    않는다.
  - `trackSaveCompleted`는 기존 `duration_bucket`과 새 aggregate fields를 함께
    보낸다.
- `src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts`
  - `saved`, `missing`, `not_requested`를 분리해 batch group별 count를 계산한다.
  - 성능점검기록부 missing이 `trackListingFailed`를 만들지 않는다.
  - 일부 차량 저장 실패가 있어도 requested count와 saved/image count가 각각
    올바르게 계산된다.
- `src/v2/application/truck-harvester-workflow/save-workflow.test.ts`
  - directory save result가 `saveSettled`에 item id별로 전달된다.
  - ZIP save result가 `sourceUrl` matching 뒤 `saveSettled`에 전달된다.
  - cancellation path는 기존처럼 settlement를 보내지 않는다.

## Implementation boundary

변경 파일은 analytics transport, workflow analytics adapter, save workflow,
그리고 해당 unit tests로 제한한다. File System Access API 구현, ZIP archive
구조, CheckPaper capture/renderer, prepared listing UI는 이번 변경에서 건드리지
않는다.

구현 후 최소 검증은 다음 명령으로 한다.

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
bun run build
```
