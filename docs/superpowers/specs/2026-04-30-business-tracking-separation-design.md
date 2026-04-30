# 비즈니스 로직과 트래킹 로직 분리 설계

작성일: 2026-04-30

## 배경

Truck Harvester의 현재 root app은 `src/app/truck-harvester-app.tsx`에서
화면 조립, 붙여넣기 처리, 미리보기 실행, 저장 실행, 폴더 권한, 알림,
Umami 트래킹 배치 매핑을 함께 담당한다. 이 구조는 동작은 명확하지만, 작은
변경도 route composition 파일을 함께 읽어야 해서 비즈니스 흐름과 트래킹 흐름의
경계가 흐려진다.

이번 설계는 React 컴포넌트가 상태와 작업을 가까이 관리하되, 재사용 가능한
비즈니스 흐름과 횡단 관심사인 트래킹은 별도 계층으로 분리한다. 참고한 컴포넌트
설계 관점처럼 UI 컴포넌트는 사용자 제스처와 렌더링에 집중하고, 업무 규칙과
트래킹 확장은 잘 정의된 인터페이스를 통해 연결한다.

## 목표

- root app 컴포넌트에서 비즈니스 use case와 analytics payload 조립을 제거한다.
- `src/v2/application/` 계층을 도입해 paste-preview-save 흐름을 명시적으로
  소유한다.
- preview/save 업무 흐름은 가능한 한 React 밖에서 테스트 가능한 순수
  TypeScript use case로 둔다.
- React hook은 mount guard, `AbortController`, local UI state, 브라우저 권한
  연결만 담당한다.
- 트래킹은 workflow fact를 Umami 이벤트로 변환하는 adapter로 분리한다.
- 기존 사용자 흐름, 한국어 문구, Umami 수집 범위, 기본 concurrency 5는
  유지한다.

## 비목표

- UI 레이아웃이나 화면 문구를 재설계하지 않는다.
- Umami 이벤트 계약 자체를 확장하지 않는다.
- 외부 에러 모니터링 SDK, 이미지 스탬핑, 서버 주도 streaming을 추가하지 않는다.
- 기존 `features/*` 능력 계층을 application 내부로 옮기지 않는다.
- 저장 폴더 영구 보관 정책을 바꾸지 않는다.

## 확정 접근

접근은 새 application 계층을 둔 혼합형으로 확정한다.

- 업무 흐름은 순수 use case에 둔다.
- React 생명주기와 브라우저 접점은 얇은 custom hook에 둔다.
- 트래킹은 업무 흐름을 관찰하는 adapter 포트로 둔다.

이 방식은 기존 FSD 스타일을 유지하면서도 route composition과 feature primitive
사이에 "앱 흐름" 계층을 명확히 만든다.

## 새 계층 구조

```txt
src/v2/application/
  AGENTS.md
  truck-harvester-workflow/
    index.ts
    preview-workflow.ts
    save-workflow.ts
    use-truck-harvester-workflow.ts
    workflow-analytics.ts
```

`src/v2/application`은 사용자가 root app에서 수행하는 업무 흐름을 소유한다.
이 계층은 `features`, `entities`, `shared`를 사용할 수 있지만 `widgets`를
import하지 않는다.

## 계층별 책임

### `src/app/truck-harvester-app.tsx`

root app은 화면 조립만 담당한다.

- workflow hook을 생성한다.
- widget props에 상태와 command를 연결한다.
- 사용자 제스처를 workflow command로 전달한다.
- analytics 함수나 batch id를 직접 import하지 않는다.
- preview/save 세부 진행 규칙을 직접 계산하지 않는다.

예상 사용 형태:

```ts
const workflow = useTruckHarvesterWorkflow()

workflow.handlePasteText(text)
workflow.startSavingReadyListings()
workflow.selectDirectory(directory)
workflow.removePreparedItem(id)
```

### `use-truck-harvester-workflow.ts`

React hook은 route composition을 얇게 유지하는 adapter다.

- prepared listing store와 onboarding store를 생성한다.
- `isMountedRef`, paste sequence, preview/save abort controller를 관리한다.
- 파일 시스템 지원 여부, 선택 폴더, 권한 상태, 알림 권한 같은 UI state를
  관리한다.
- preview/save use case를 호출하고 화면에 필요한 command를 반환한다.
- workflow tracker 인스턴스를 생성해 use case에 주입한다.

### `preview-workflow.ts`

preview use case는 붙여넣기부터 매물 확인 완료까지의 업무 규칙을 소유한다.

- `parseUrlInputText` 결과를 받아 지원 주소 여부를 판단한다.
- 지원하지 않는 비어 있지 않은 입력 fact를 tracker에 알린다.
- 지원 주소가 있으면 analytics batch를 시작한다.
- `prepareListingUrls`를 호출해 prepared listing store를 갱신한다.
- preview 완료 fact와 listing failure fact를 tracker에 알린다.
- duplicate helper message를 반환한다.
- Umami 이벤트명, payload 필드명, `window.umami`를 모른다.

### `save-workflow.ts`

save use case는 ready listing 저장 흐름을 소유한다.

- 저장 대상 ready listing을 고정한다.
- directory 저장과 ZIP fallback 경로를 실행한다.
- prepared listing store의 saving/saved/failed 상태 전환을 수행한다.
- 저장 실패한 listing fact와 batch-level save fact를 tracker에 알린다.
- 성공 저장 수를 반환해 hook이 완료 알림을 보낼 수 있게 한다.
- 폴더 선택 UI나 권한 prompt 자체는 hook이 해결한 값으로 주입받는다.

### `workflow-analytics.ts`

workflow analytics는 업무 fact를 기존 Umami transport로 변환한다.

- batch id 생성과 listing id -> batch 매핑을 소유한다.
- preview/save batch group 계산을 소유한다.
- `trackBatchStarted`, `trackPreviewCompleted`, `trackSaveStarted`,
  `trackSaveCompleted`, `trackSaveFailed`, `trackListingFailed`,
  `trackUnsupportedInputFailure` 호출을 캡슐화한다.
- 실패 매물에만 URL, 차량번호, 차명, 이미지 수를 포함하는 기존 정책을 유지한다.
- prepared listing store를 직접 mutate하지 않는다.

## 트래킹 포트

use case는 구체 Umami wrapper 대신 `WorkflowTracker` 포트에 업무 사실을 알린다.

```ts
interface WorkflowTracker {
  unsupportedInputFailed(event: UnsupportedInputFailedFact): void
  previewStarted(event: PreviewStartedFact): AnalyticsBatchRef
  previewCompleted(event: PreviewCompletedFact): void
  listingFailed(event: ListingFailedFact): void
  saveStarted(event: SaveStartedFact): void
  saveCompleted(event: SaveCompletedFact): void
  saveFailed(event: SaveFailedFact): void
  removeListing(id: string): void
}
```

포트의 입력은 업무 언어를 사용한다. `batch_id`, `failure_stage`,
`listing_url`, `vehicle_number`, `save_method` 같은 Umami 계약 필드는
`workflow-analytics.ts` 내부에서만 다룬다.

## 데이터 흐름

붙여넣기 흐름:

```txt
ListingChipInput
  -> useTruckHarvesterWorkflow.handlePasteText(text)
  -> preview-workflow parses supported addresses
  -> listing-preparation store adds/checks/marks items
  -> workflow-analytics receives preview facts
  -> shared analytics wrapper sends Umami events safely
```

저장 흐름:

```txt
ListingChipInput start button
  -> useTruckHarvesterWorkflow.startSavingReadyListings()
  -> hook resolves directory permission or ZIP fallback
  -> save-workflow saves ready listings
  -> listing-preparation store marks saving/saved/failed
  -> workflow-analytics receives save facts
  -> completion notification fires after successful saved count
```

## 의존성 규칙

- `src/app`은 `src/v2/application`, `features`, `widgets`, `shared/model`을
  조립할 수 있다.
- `src/v2/application`은 `entities`, `features`, `shared`를 import할 수 있다.
- `src/v2/application`은 `widgets`를 import하지 않는다.
- `features`는 `application`을 import하지 않는다.
- `widgets`는 tracking 함수를 import하지 않는다.
- `shared/lib/analytics.ts`는 Umami transport와 payload builder로 남고, app
  workflow 상태를 알지 않는다.

## 마이그레이션 계획

1. `src/v2/application/AGENTS.md`와 workflow slice public API를 만든다.
2. `workflow-analytics.ts`를 추가해 현재 root app의 analytics batch helper와
   tracking 호출을 옮긴다.
3. `preview-workflow.ts`를 추가해 `handlePasteText`의 파싱, preview, duplicate
   message, preview tracking 결정을 옮긴다.
4. `save-workflow.ts`를 추가해 저장 루프와 save tracking 결정을 옮긴다.
5. `use-truck-harvester-workflow.ts`를 추가해 React state, mount guard, abort,
   directory/notification 연결을 소유하게 한다.
6. `truck-harvester-app.tsx`를 workflow hook 기반으로 축소한다.
7. architecture 문서와 layer AGENTS 문서를 갱신한다.

각 단계는 기존 동작을 유지해야 하며, UI 문구 변경은 별도 의도가 있을 때만
허용한다.

## 테스트 계획

### `preview-workflow.test.ts`

- 지원 주소 붙여넣기에서 batch started와 preview completed fact가 발생한다.
- 지원하지 않는 비어 있지 않은 입력은 unsupported input fact만 발생한다.
- 공백 입력은 tracking fact를 만들지 않는다.
- duplicate 주소는 실패 이벤트가 아니다.
- preview 실패와 missing listing identity는 listing failure fact로 전달된다.
- abort cleanup은 checking item을 정리하고 failure fact를 만들지 않는다.

### `save-workflow.test.ts`

- directory 저장 성공 시 saving -> saved 전환과 save completed fact가 발생한다.
- directory 저장 일부 실패 시 실패 item만 listing failure fact를 만든다.
- ZIP fallback 성공 시 대상 전체가 saved가 된다.
- ZIP fallback 실패 시 대상 전체가 failed가 되고 save failed fact가 발생한다.
- save 취소는 실패 이벤트로 기록하지 않는다.

### `workflow-analytics.test.ts`

- workflow fact가 기존 Umami wrapper 입력으로 정확히 변환된다.
- 성공 매물 payload에는 URL, 차량번호, 차명이 포함되지 않는다.
- 저장 실패한 parsed listing만 차량번호, 차명, 이미지 수를 포함한다.
- removed listing id는 batch 매핑과 save failure 상태에서 제거된다.
- fallback save batch는 기존 batch 매핑이 없는 ready item에도 안전하게 생성된다.

### `truck-harvester-app.test.tsx`

- UI 통합 테스트는 붙여넣기와 저장 버튼이 workflow command를 통해 동작하는지
  확인한다.
- analytics 세부 payload 검증은 application 계층 테스트로 이동한다.
- 온보딩 중 background controls 비활성화, 폴더 영구 보관 금지, saved listing
  표시 같은 route-level 보장은 유지한다.

## 문서 갱신

- `docs/architecture.md`: `src/v2/application` 계층과 tracking adapter 경계를
  추가한다.
- `src/v2/AGENTS.md`: layer map에 application 계층을 추가한다.
- `src/v2/application/AGENTS.md`: application 계층의 import 규칙과 testing
  규칙을 둔다.
- 필요하면 `docs/runbooks/`에 workflow 변경 시 만질 위치를 추가한다.

## Implementation Plan

Execution plan: `docs/superpowers/plans/2026-04-30-business-tracking-separation.md`

## 수용 기준

- `truck-harvester-app.tsx`는 analytics wrapper를 직접 import하지 않는다.
- route component는 batch id, analytics batch group, failure payload를 직접
  만들지 않는다.
- preview/save use case는 React component 없이 단위 테스트된다.
- workflow analytics는 prepared listing store를 직접 mutate하지 않는다.
- 기존 analytics 수집 정책이 유지된다.
- `bun run typecheck`, `bun run lint`, `bun run format:check`,
  `bun run test -- --run`이 통과한다.

## 리스크와 완화

- 파일 이동으로 테스트 mock 경계가 흔들릴 수 있다. 먼저 application 테스트를
  추가한 뒤 route 통합 테스트를 얇게 줄인다.
- tracking adapter가 비대해질 수 있다. Umami payload 변환과 batch 매핑 외의
  업무 규칙은 preview/save use case에 남긴다.
- 새 계층이 또 다른 애매한 shared 폴더가 될 수 있다. application은 root app
  workflow만 소유하고, generic helper는 `shared`로 보내지 않는다.
