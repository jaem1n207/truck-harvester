# 카모두 성능점검기록부 native renderer 설계

## 배경

Truck Harvester는 truck-no1 매물 주소에서 차량 이미지, 원고, 성능점검기록부
이미지를 차량별 폴더나 ZIP으로 저장한다. 기존 CheckPaper 계열
성능점검기록부는 printable PDF를 PDF renderer로 JPG 변환해 저장하고, Carmodoo
`carmodooPrint.do?checkNum=...` 문서는 client-side HTML capture 경로로 저장한다.

현재 Carmodoo 경로는 `html2canvas`로 `.page_wrap`을 캡처한다. 여러 차례 scale,
checkbox, print layout, table 합성 보정을 적용했지만 실제 화면과 같은 정렬을
얻지 못했다. 동일한 Carmodoo DOM과 CSS를 대상으로 Chrome native screenshot과
`html2canvas` 렌더를 비교한 결과, Chrome native screenshot은 정렬이 맞고
`html2canvas` 렌더만 텍스트, 체크박스, table line 정렬이 틀어진다.

따라서 남은 문제는 Carmodoo HTML이나 proxy rewrite 문제가 아니라 renderer
경계의 문제다. `html2canvas`는 브라우저 엔진의 최종 paint 결과를 저장하지 않고
HTML/CSS를 자체 해석해 canvas로 다시 그린다. Carmodoo처럼 조밀한 Korean table,
checkbox, border, 작은 font가 섞인 문서에서는 이 방식으로 실제 화면 parity를
보장하기 어렵다.

## 목표

- Carmodoo 성능점검기록부를 실제 브라우저 렌더링과 같은 정렬의 JPG로 저장한다.
- 사용자는 기존처럼 매물 URL 붙여넣기와 저장 시작만 수행한다.
- 기존 CheckPaper PDF 저장 흐름을 깨지 않는다.
- Carmodoo renderer 실패는 계속 non-fatal로 유지한다.
- 저장 파일명과 폴더 구조를 유지한다.
- UI에 `Carmodoo`, `renderer`, `proxy`, `Chromium`, `Playwright` 같은 개발자
  용어를 노출하지 않는다.

## 비목표

- 사용자가 PDF를 직접 저장하거나 다시 업로드하는 수동 흐름을 만들지 않는다.
- 네이버 스마트스토어 업로드 자동화는 포함하지 않는다.
- raw 성능점검기록부 URL이나 차량 식별자를 analytics payload에 추가하지 않는다.
- 기존 CheckPaper PDF renderer를 native renderer로 바꾸지 않는다.
- 외부 error-monitoring SDK나 image stamping pipeline을 추가하지 않는다.
- `html2canvas`를 전역 제거하지 않는다. 기존 CheckPaper HTML fallback이나 테스트
  주입 지점은 필요한 범위에서 유지할 수 있다.

## 선택한 접근

Carmodoo 성능점검기록부만 native browser renderer provider로 분리한다.

기존 저장 계층은 `capturePerformanceCheckImages()`가 반환하는 `Uint8Array[]`만
알고 있다. 이 계약을 유지하면서 Carmodoo provider 내부 구현만 바꾼다. Carmodoo
URL이 들어오면 client-side `html2canvas` capture 대신 same-origin API route가
Chromium 기반 renderer로 proxied Carmodoo page를 실제 브라우저처럼 렌더링하고,
2-up sheet 단위 JPG bytes를 반환한다.

사용자 흐름은 바뀌지 않는다. 사용자는 저장 버튼을 누르고, 성공하면 기존처럼
`성능점검기록부/{차량번호}_성능점검기록부_1.jpg`,
`성능점검기록부/{차량번호}_성능점검기록부_2.jpg` 파일을 얻는다.

## 사용자 경험

최우선 사용성 기준은 "기존 저장 흐름 그대로, 결과물만 정확해지는 것"이다.

- 사용자는 별도 print dialog를 열지 않는다.
- 사용자는 PDF 저장, 파일 선택, 재업로드를 하지 않는다.
- 브라우저 권한 요청은 기존 저장 폴더 선택 외에 늘리지 않는다.
- Carmodoo 렌더링이 실패해도 차량 이미지와 원고는 저장된다.
- 완료 요약은 기존처럼 성능점검기록부 확인이 필요한 차량만 조용히 알려준다.

## Architecture

### Provider 경계

성능점검기록부 provider registry는 유지한다.

- `checkpaper-pdf`: 기존 CheckPaper printable PDF를 가져와 PDF page를 JPG로
  변환한다.
- `carmodoo-native`: Carmodoo `checkNum` HTML을 native browser renderer API에
  위임한다.

provider는 다음 책임만 가진다.

- URL을 처리할 수 있는지 판단한다.
- 필요하면 proxy나 renderer API URL을 만든다.
- 최종 JPG bytes 배열을 반환한다.

provider는 파일명, 폴더 생성, ZIP 작성, UI 상태를 알지 않는다.

예상 형태:

```ts
type PerformanceCheckCaptureProvider = {
  id: 'checkpaper-pdf' | 'carmodoo-native'
  canHandle: (url: URL) => boolean
  capture: (url: URL, context: CaptureContext) => Promise<Uint8Array[]>
}
```

### Native renderer API

새 route는 Carmodoo URL만 받는다. 예상 endpoint는
`POST /api/v2/checkpaper/carmodoo-render`다.

입력:

```json
{
  "url": "https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658"
}
```

출력은 JSON보다 binary에 가깝게 설계한다. 구현 선택지는 두 가지다.

- `application/json`으로 base64 JPG 배열을 반환한다.
- `application/zip`이나 multipart로 JPG bytes를 반환한다.

초기 구현은 클라이언트 저장 계층과 테스트가 단순한 base64 JSON을 우선한다.
이미지는 2장 정도라 payload 크기가 관리 가능하다. 이미지가 비정상적으로 커지는
경우를 막기 위해 응답 크기와 page count 상한을 둔다.

### Renderer 동작

renderer route는 다음 순서로 동작한다.

1. 요청 URL을 검증한다.
2. URL host가 `ck.carmodoo.com`이고 path가
   `/carCheck/carmodooPrint.do`이며 `checkNum`이 있는지 확인한다.
3. 기존 `/api/v2/checkpaper?url=...` proxy 또는 같은 rewrite helper를 통해
   script 제거와 asset rewrite가 적용된 HTML을 준비한다.
4. Chromium page에 same-origin rewritten HTML을 로드한다.
5. 필요한 CSS와 이미지가 로드될 때까지 기다린다.
6. browser print preview와 같은 landscape 2-up sheet 크기와 여백을 적용한다.
7. `.page_wrap` sheet를 native screenshot으로 캡처한다.
8. 각 screenshot을 JPG bytes로 변환해 반환한다.

핵심은 `html2canvas`를 사용하지 않는 것이다. DOM을 canvas library가 다시 그리지
않고, Chromium이 실제 layout과 paint를 수행한 결과를 screenshot으로 저장한다.

### Runtime 선택

Next.js route runtime은 `nodejs`로 둔다. Renderer 구현은 Playwright 기반으로
설계한다. 현재 Playwright는 test용 devDependency이므로 implementation plan에서
runtime dependency 승격 여부와 Chromium binary 제공 방식을 검증한다.

배포 환경에서 browser binary를 사용할 수 있는지 확인해야 한다. 가능하면 다음
순서로 선택한다.

1. Playwright를 server renderer runtime dependency로 사용할 수 있는지 확인한다.
2. 배포 환경에 맞는 lightweight Chromium package가 필요한지 확인한다.
3. 배포 제약이 크면 local/desktop 사용을 우선한 fallback 문구를 설계하되, 사용자가
   수동 파일 작업을 하게 만들지는 않는다.

## Data Flow

1. parser가 매물 페이지에서 `성능점검보기` 링크를 찾아 `performanceCheckUrl`로
   반환한다.
2. save flow가 `capturePerformanceCheckImages(performanceCheckUrl)`를 호출한다.
3. capture layer가 direct URL 또는 resolved final URL로 provider를 고른다.
4. CheckPaper PDF면 기존 PDF renderer를 사용한다.
5. Carmodoo면 `carmodoo-native` provider가 renderer API에 URL을 보낸다.
6. renderer API가 native screenshot 기반 JPG bytes 배열을 반환한다.
7. file-system과 ZIP fallback은 기존 경로와 파일명으로 bytes를 저장한다.
8. 실패 시 성능점검기록부만 `missing`으로 처리하고 차량 저장은 계속한다.

## Error Handling

- URL이 Carmodoo allowlist 조건을 만족하지 않으면 400으로 거부한다.
- Carmodoo HTML을 불러오지 못하면 renderer API는 실패 응답을 반환한다.
- page load, asset load, screenshot, JPG 변환이 timeout을 넘으면 실패한다.
- 실패는 capture layer에서 기존 non-fatal missing 흐름으로 흡수한다.
- renderer page와 browser context는 성공/실패와 관계없이 정리한다.
- 사용자에게는 기존 완료 요약과 확인 필요 라벨만 보여준다.

## Security

- renderer API는 `ck.carmodoo.com` Carmodoo print URL만 허용한다.
- 기존 proxy의 script 제거, inline event 제거, asset allowlist 정책을 유지한다.
- renderer가 외부 arbitrary URL screenshot service가 되지 않게 한다.
- redirect가 allowlist 밖으로 나가면 차단한다.
- active document asset 차단 규칙은 유지한다.
- 요청 body 크기와 응답 page count를 제한한다.

## Testing

### Unit tests

- Carmodoo URL만 `carmodoo-native` provider가 처리한다.
- CheckPaper PDF URL은 기존 `checkpaper-pdf` provider를 계속 사용한다.
- renderer API client가 base64 JPG 배열을 `Uint8Array[]`로 변환한다.
- renderer API 실패는 기존 capture 실패와 같은 방식으로 전파된다.
- save layer는 반환된 2개 bytes를 기존 파일명으로 저장한다.

### Route tests

- `POST /api/v2/checkpaper/carmodoo-render`가 Carmodoo URL을 허용한다.
- allowlist 밖 URL, missing `checkNum`, 잘못된 method/body는 거부한다.
- renderer timeout과 internal error는 user-facing Korean error response로
  변환된다.

### Visual verification

자동 unit test만으로는 이 문제를 충분히 검증할 수 없다. 구현 후에는 실제 실패 URL
또는 fixture HTML로 native screenshot 결과를 생성하고, 다음을 확인한다.

- Chrome native screenshot과 renderer API 결과의 table/text/checkbox 정렬이
  일치한다.
- `html2canvas` 결과에서 보이던 baseline drift와 checkbox offset이 사라진다.
- 저장된 `성능점검기록부_1.jpg`, `성능점검기록부_2.jpg`가 사용자가 첨부한 실제
  화면/print preview와 같은 구조를 가진다.

## Rollout

1. `carmodoo-native` provider와 renderer API를 추가한다.
2. Carmodoo capture 경로에서 `html2canvas` renderer를 제거한다.
3. 기존 CheckPaper PDF tests와 Carmodoo provider tests를 통과시킨다.
4. 실제 Carmodoo URL로 visual verification을 수행한다.
5. 문서의 CheckPaper Integration 설명을 native renderer 기준으로 갱신한다.

## Verification Commands

기본 검증 명령은 다음이다.

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
```

`bun run build`는 Turbopack과 renderer dependency가 process나 port binding을 할 수
있으므로 sandbox에서 막히면 권한 상승으로 다시 실행한다.
