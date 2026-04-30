# Duration Bucket Analytics Review Fix Design

작성일: 2026-04-30

## 배경

최근 `duration_bucket` 분석 속성은 공용 배치 payload builder인
`toBatchEventData()`에 추가되었다. 이 구조는 구현은 작지만
`batch_started`, `preview_completed`, `save_started`, `save_failed`,
`save_completed` 모두에 `duration_bucket`을 전송한다.

체크인된 설계 문서의 분석 질문은 `save_completed` 기준 작업 완료 시간
분포다. `batch_started`처럼 거의 항상 0초대인 이벤트가 같은 속성을 가지면
Umami Properties 화면에서 이벤트를 잘못 선택했을 때 분석 의미가 흐려진다.

또한 현재 `toDurationBucket()`은 `NaN`, `Infinity`, 음수를 0초대로
보정하지만, 같은 payload의 `duration_ms`는 원본 `input.durationMs`를 그대로
보낸다. 미래 caller가 비정상 값을 넘기면 `duration_ms`와
`duration_bucket`이 서로 다른 기준의 값이 된다.

## 목표

- `duration_bucket`은 우선 `save_completed` 이벤트에만 전송한다.
- `duration_ms`와 `duration_bucket`은 같은 정규화된 duration 값을 사용한다.
- 기존 `duration_ms` 숫자 속성은 유지한다.
- 성공 매물 식별 정보 비수집 원칙은 유지한다.
- 앱 UI, 사용자 작업 흐름, Umami script 설정은 바꾸지 않는다.

## 비목표

- `preview_completed`나 `save_failed`에 duration bucket을 추가하지 않는다.
- 평균, 중앙값, p95를 앱 UI에 표시하지 않는다.
- 사용자 식별자를 추가하지 않는다.
- Umami 대시보드나 export 파이프라인을 구현하지 않는다.

## 확정 접근

`duration_bucket`은 `trackSaveCompleted()`에서만 붙인다.
`toBatchEventData()`는 공통 배치 이벤트 속성만 만든다.

정규화는 작은 helper로 분리한다.

```ts
const normalizeDurationMs = (durationMs: number) => {
  if (!Number.isFinite(durationMs)) {
    return 0
  }

  return Math.max(0, Math.floor(durationMs))
}
```

`Math.floor()`를 쓰는 이유는 기존 경계값 보정 의도를 유지하기 위해서다.
`999.9ms`는 여전히 1초 미만이며, `1000ms`부터 `01_1s`가 된다. 현재
workflow analytics는 이미 `Math.round(now() - startedAt)`으로 정수 duration을
만들어 전달하므로, production path에서는 값 변화가 없다. 이 helper는
analytics transport 경계에서 비정상 입력과 미래 직접 호출을 방어한다.

## 데이터 흐름

1. workflow layer는 기존처럼 `BatchAnalyticsInput.durationMs`를 전달한다.
2. analytics transport는 `normalizeDurationMs(input.durationMs)`를 계산한다.
3. 공통 배치 payload는 정규화된 `duration_ms`만 포함한다.
4. `trackSaveCompleted()`는 공통 payload에
   `duration_bucket: toDurationBucket(normalizedDurationMs)`를 추가한다.
5. 다른 배치 이벤트는 `duration_ms`만 보내고 `duration_bucket`은 보내지 않는다.

## API 경계

- `toBatchEventData(input)`은 계속 export한다.
- `toDurationBucket(durationMs)`은 계속 export한다.
- `normalizeDurationMs()`는 내부 helper로 둔다. 외부 caller가 duration
  정규화 정책에 의존하지 않게 analytics transport 내부에 가둔다.
- `trackSaveCompleted(input)`은 내부에서 save-completed 전용 payload를 만든다.
  별도 public builder를 추가하지 않는다.

## 테스트 계획

- `toDurationBucket()` 경계 테스트는 유지한다.
  - `999.9`는 `00_under_1s`
  - `1000`은 `01_1s`
  - `9999.9`는 `09_9s`
  - `10000`은 `10_10s_plus`
- `toBatchEventData()` expectation에서 `duration_bucket`이 없음을 검증한다.
- `toBatchEventData()`가 `NaN`, `Infinity`, 음수 duration을 `duration_ms: 0`으로
  정규화하는 케이스를 추가한다.
- `trackSaveCompleted()`가 정규화된 `duration_ms`와 `duration_bucket`을 함께
  전송하는지 검증한다.
- `trackBatchStarted()` 같은 다른 batch event가 `duration_bucket`을 보내지
  않는지 최소 한 케이스로 검증한다.
- 기존 fallback 동작은 유지한다. `window.umami`가 없거나 `track()`이 예외를
  던져도 앱 작업은 실패하지 않는다.

## 유지보수 기준

나중에 `preview_completed`나 `save_failed`에도 bucket 분석이 필요하면
`trackSaveCompleted()` 전용 분기를 복사하지 않는다. 그 시점에는 어떤 이벤트에
bucket을 붙일지 명시한 작은 allowlist나 event-specific payload builder를
도입하고, 설계 문서도 함께 갱신한다.

이번 변경은 분석 의미를 좁히는 수정이다. 데이터 수집량을 늘리는 변경이
아니므로 privacy boundary는 그대로 유지된다.
