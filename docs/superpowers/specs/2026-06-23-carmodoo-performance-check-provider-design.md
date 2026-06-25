# 카모두 성능점검기록부 provider 설계

> 상태: 이 문서는 Carmodoo 지원을 처음 추가하기 위한 provider/HTML capture 설계
> 기록이다. 이후 `html2canvas` 기반 캡처가 실제 화면 정렬을 재현하지 못해
> `docs/superpowers/specs/2026-06-24-carmodoo-native-renderer-design.md`의 native
> Chromium renderer 설계로 대체되었다. 현재 구현 기준 문서는 2026-06-24 native
> renderer 설계를 따른다.

## 배경

Truck Harvester는 truck-no1 매물 주소에서 차량 이미지, 원고, 성능점검기록부
이미지를 차량별 폴더나 ZIP으로 저장한다. 기존 성능점검기록부 저장은
CheckPaper 계열 URL을 printable PDF URL로 바꾼 뒤 PDF page를 JPG로 렌더링하는
흐름에 맞춰져 있다.

실패 매물
`https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=30195108&MemberNo=1000294965&OnCarNo=2024300329293`
는 매물 페이지에 `autocafe.co.kr/ASSO/CarCheck_Form_my.asp?...` 링크를 갖지만,
최종 성능점검기록부는
`https://ck.carmodoo.com/carCheck/carmodooPrint.do?print=0&checkNum=7126000658`
형태의 Carmodoo HTML 문서다. 이 문서는 PDF 다운로드 주소가 아니라
`page_wrap`, `page_col1`, `page_col2`로 이미 1+2쪽, 3+4쪽을 한 화면에 배치하는
print layout을 갖는다.

현재 구현은 `ck.carmodoo.com`을 proxy allowlist에 포함하지 않고,
`check_id`와 `checkNo` 기반 PDF 파생만 지원한다. 그래서 Carmodoo HTML 문서는
printable record URL을 찾지 못해 성능점검기록부 저장이 `missing`으로 처리될 수
있다.

## 목표

- Carmodoo `checkNum` 기반 성능점검기록부를 JPG로 저장한다.
- 기존 CheckPaper PDF 저장 흐름을 깨지 않는다.
- 성능점검기록부 provider 선택과 렌더링 전략을 분리해 이후 다른 기록부
  형식도 추가하기 쉽게 한다.
- Carmodoo HTML의 2-up print layout을 보존해 `성능점검기록부_1.jpg`,
  `성능점검기록부_2.jpg`처럼 저장한다.
- 성능점검기록부 저장 실패는 계속 non-fatal로 유지한다.

## 비목표

- 사용자 UI를 새로 디자인하지 않는다.
- raw 성능점검기록부 URL이나 차량 식별자를 analytics payload에 추가하지 않는다.
- headless browser, 외부 error-monitoring SDK, 이미지 stamping pipeline을
  추가하지 않는다.
- `ck.carmodoo.com` 외의 새 외부 host를 함께 열지 않는다.
- 네이버 스마트스토어 업로드 자동화는 이번 범위에 포함하지 않는다.

## 선택한 접근

성능점검기록부 캡처에 작은 provider registry를 둔다.

기존 `capturePerformanceCheckImages()`는 URL parsing, redirect resolve,
PDF fetch, HTML iframe capture를 한 파일 안에서 직접 결정한다. 이 결정을
provider 단위로 나누면 현재 CheckPaper PDF 흐름과 Carmodoo HTML 흐름을 같은
저장 인터페이스로 다룰 수 있다.

첫 provider는 기존 동작을 옮긴 `checkpaperPdfProvider`다. `record.do`,
`check_id`, `checkNo` URL을 printable PDF로 바꾸고 PDF page를 canvas로 렌더링한
뒤 JPG bytes를 반환한다.

두 번째 provider는 `carmodooHtmlProvider`다.
`ck.carmodoo.com/carCheck/carmodooPrint.do?...checkNum=...` URL을 same-origin
proxy iframe에 렌더링하고, `.repaircheck_box .page_wrap` 요소를 한 장의 JPG로
캡처한다. 실제 Carmodoo HTML은 `.page_wrap` 하나 안에 좌우 2쪽이 들어 있으므로
4쪽 문서는 JPG 2장을 반환한다.

## Provider 경계

provider는 다음 책임만 가진다.

- 자신이 처리할 수 있는 URL인지 판단한다.
- 필요하면 canonical URL이나 printable URL을 만든다.
- 캡처 결과를 `Uint8Array[]`로 반환한다.

provider는 파일명, 폴더 생성, ZIP 작성, UI 상태를 알지 않는다. 이 경계를
지키면 File System Access API 저장과 ZIP fallback은 기존 저장 구조를 그대로
재사용할 수 있다.

예상 형태:

```ts
type PerformanceCheckProvider = {
  id: 'checkpaper-pdf' | 'carmodoo-html'
  hosts: ReadonlySet<string>
  canHandle: (url: URL) => boolean
  capture: (url: URL, context: CaptureContext) => Promise<Uint8Array[]>
}
```

`capturePerformanceCheckImages()`는 provider registry에서 직접 처리 가능한
provider를 찾는다. 찾지 못하면 기존처럼 proxy를 통해 최종 URL을 resolve하고,
resolve된 URL로 provider 선택을 한 번 더 시도한다. 그래도 provider가 없으면
기존 `missing` 흐름으로 떨어질 수 있도록 오류를 던진다.

## URL 처리

지원 URL은 다음과 같이 나눈다.

- CheckPaper PDF provider
  - `checkpaper.jmenetworks.co.kr/view/record.do?check_id=...`
  - `checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=...`
  - 기존 `autocafe.co.kr` 중간 URL이 redirect 또는 final URL header로 위 URL에
    도달하는 경우
- Carmodoo HTML provider
  - `ck.carmodoo.com/carCheck/carmodooPrint.do?checkNum=...`
  - 기존 `autocafe.co.kr` 중간 URL이 redirect 또는 final URL header로 위 URL에
    도달하는 경우

`autocafe.co.kr`은 자체 renderer provider가 아니라 final URL resolver 대상이다.
이렇게 두면 중간 URL과 실제 문서 형식을 분리할 수 있다.

## Proxy 안전 규칙

CheckPaper proxy helper의 allowlist는 provider host set에서 구성하거나,
최소한 `ck.carmodoo.com`을 명시적으로 추가한다. 허용 host는 다음으로 제한한다.

- `autocafe.co.kr`
- `checkpaper.jmenetworks.co.kr`
- `ck.carmodoo.com`

HTML proxy는 기존처럼 script tag와 inline event handler를 제거한다. asset proxy는
허용 host의 CSS, 이미지, PDF 같은 passive asset만 통과시키고, HTML/XML/SVG 같은
active document content type은 계속 차단한다. redirect가 allowlist 밖으로 나가면
기존처럼 차단한다.

Carmodoo 문서는 일부 checkbox와 사고 표시를 script로 채운다. script를 그대로
실행하지 않고, proxy rewrite 단계에서 알려진 literal 초기화 데이터만 DOM에
안전하게 반영한다. 예를 들어 `setData('bc', '{"2":"1"}')`처럼 HTML 안에 박힌
JSON literal은 해당 `#bc_2_1` checkbox의 `checked` attribute로 옮긴 뒤 script를
제거한다. 파싱할 수 없는 script나 외부 script는 실행하지 않는다.

## Carmodoo 렌더링

Carmodoo provider는 기존 HTML iframe capture 경로를 재사용하되 page selector와
print layout 주입을 provider 전용으로 둔다.

- iframe source는 `/api/v2/checkpaper?url=...` proxy URL이다.
- page selector는 `.repaircheck_box .page_wrap`이다.
- capture 전에 iframe document에 provider 전용 print layout style을 주입한다.
- 각 `.page_wrap`을 `html2canvas`로 캡처해 JPG bytes로 변환한다.

주입할 style은 원본 `print_repair.css`의 핵심 print rules만 최소화한다.

- `.repaircheck_box { width: 1400px }`
- `.page_wrap { height: 950px; page-break-after: always }`
- `.page_col1 { float: left; width: 49% }`
- `.page_col2 { float: right; width: 49% }`
- `.fuc_print { display: block }`
- `.repaircheck_box .btn_box { display: none }`

이 방식은 브라우저 print preview의 2-up 구조를 모방하지만, 브라우저의 실제 print
dialog를 열지 않는다. 사용자는 기존 저장 버튼만 누르면 된다.

## 데이터 흐름

1. parser가 매물 페이지에서 `성능점검보기` 링크를 찾아 `performanceCheckUrl`로
   반환한다.
2. save flow가 `capturePerformanceCheckImages(performanceCheckUrl)`를 호출한다.
3. capture layer가 원본 URL로 provider를 찾는다.
4. provider가 없으면 `/api/v2/checkpaper` proxy로 final URL을 resolve한다.
5. resolved URL로 provider를 다시 찾는다.
6. CheckPaper PDF provider면 PDF page들을 JPG bytes로 만든다.
7. Carmodoo HTML provider면 `.page_wrap` 단위 JPG bytes를 만든다.
8. file-system과 ZIP fallback은 반환된 bytes를 기존
   `성능점검기록부/{차량번호}_성능점검기록부_N.jpg` 경로에 저장한다.

## 에러 처리

- provider를 찾지 못하면 성능점검기록부만 `missing` 처리한다.
- proxy가 4xx/5xx를 반환하면 성능점검기록부만 `missing` 처리한다.
- Carmodoo HTML에 `.page_wrap`이 없으면 성능점검기록부만 `missing` 처리한다.
- PDF나 HTML 캡처가 timeout, abort, canvas conversion 오류를 만나도 iframe과
  event listener를 정리한다.
- 차량 이미지와 원고 저장이 성공했다면 차량 저장은 성공으로 본다.
- 사용자에게는 기존 완료 요약과 `성능점검기록부 확인 필요` 라벨만 보여준다.
  `Carmodoo`, `provider`, `proxy`, `PDF`, `HTML` 같은 개발자 용어를 노출하지
  않는다.

## 테스트 계획

### Proxy helper

- `ck.carmodoo.com/carCheck/carmodooPrint.do?...checkNum=...` URL을 허용한다.
- Carmodoo HTML의 CSS/image URL을 `/api/v2/checkpaper/asset`으로 rewrite한다.
- Carmodoo action/href/src가 allowlist 밖을 가리키면 제거하거나 안전한 값으로
  바꾼다.
- unsafe redirect는 계속 차단한다.
- Carmodoo literal 초기화 데이터를 안전하게 checkbox/image DOM 상태로 옮긴다.

### API routes

- `GET /api/v2/checkpaper`가 Carmodoo HTML을 fetch하고
  `x-checkpaper-final-url` header를 유지한다.
- `GET /api/v2/checkpaper/asset`이 Carmodoo CSS와 이미지를 허용한다.
- asset route는 HTML/XML/SVG active document content type을 계속 거부한다.

### Capture provider

- `checkNo`와 `record.do` URL은 CheckPaper PDF provider를 사용한다.
- `checkNum` Carmodoo URL은 Carmodoo HTML provider를 사용한다.
- `autocafe` URL을 resolve한 결과가 Carmodoo URL이면 Carmodoo provider를 사용한다.
- Carmodoo 4쪽 HTML에서 `.page_wrap` 2개를 캡처해 JPG bytes 2개를 반환한다.
- `.page_wrap`이 없으면 오류를 던지고 iframe을 정리한다.
- timeout과 abort 상황에서 기존 cleanup 동작을 유지한다.

### Save layer

- provider가 2장 반환하면 file-system 저장은 기존 파일명으로 2개 JPG를 만든다.
- ZIP fallback도 같은 경로와 파일명으로 2개 JPG를 넣는다.
- provider 실패는 기존처럼 `performanceCheckStatus: 'missing'`으로 흡수한다.

## 검증

기본 검증 명령은 다음이다.

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
```

`bun run build`는 Turbopack이 내부 process나 port binding을 할 수 있으므로
sandbox에서 막히면 권한 상승으로 다시 실행한다.
