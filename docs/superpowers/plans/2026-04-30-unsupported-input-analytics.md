# Unsupported Input Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track non-empty pasted input that contains no supported truck listing URL as one bounded `listing_failed / invalid_url` Umami event.

**Architecture:** Keep URL extraction as business logic and Umami payload creation inside `src/v2/shared/lib/analytics.ts`. `TruckHarvesterApp` only detects that parsing failed and delegates unsupported-input tracking to the analytics boundary; UI widgets remain unaware of analytics. Unsupported input sends at most one failure event per failed paste, with a whitespace-normalized 160-character sample.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Vitest, Umami Cloud tracker.

---

## Scope Check

This plan covers one subsystem: unsupported input analytics for the existing root Truck Harvester paste flow. It does not build a custom dashboard, introduce new analytics providers, collect success listing identifiers, or send one event per malformed token.

## File Structure

- Modify `src/v2/shared/lib/analytics.ts`: Add the bounded unsupported-input sample builder, add `input_was_truncated` to failure payloads, and expose `trackUnsupportedInputFailure`.
- Modify `src/v2/shared/lib/__tests__/analytics.test.ts`: Cover sample normalization, truncation, empty input suppression, and the new helper's `listing_failed` behavior.
- Modify `src/app/truck-harvester-app.tsx`: When `parseUrlInputText` fails for a non-empty paste, delegate to `trackUnsupportedInputFailure` before showing the existing helper message.
- Modify `src/app/__tests__/truck-harvester-app.test.tsx`: Cover unsupported non-empty input, empty input, and valid URL plus surrounding prose.
- Modify `docs/superpowers/specs/2026-04-29-umami-analytics-design.md`: Fold the unsupported-input decision into the original Umami event contract.
- Modify `docs/architecture.md`: Document that unsupported non-empty input uses the failed-listing diagnostics path with a bounded sample.
- Modify `AGENTS.md`: Update the analytics collection rule so future agents know bounded unsupported input samples are allowed only in the failed-listing diagnostics event.

## Event Contract

Unsupported input uses the existing event name:

- `listing_failed`

Unsupported input payload:

- `batch_id`: a random per-paste failure batch id
- `failure_stage`: `invalid_url`
- `failure_reason`: `unsupported_input`
- `listing_url`: trimmed, whitespace-collapsed input sample, capped at 160 characters
- `input_was_truncated`: whether the normalized input exceeded 160 characters
- `elapsed_ms`: time from paste handling start to tracking call

The existing `listing_url` key stays because Umami analysis already groups failed-listing diagnostics by that field. In `invalid_url` events with `failure_reason: unsupported_input`, this field may be an input sample rather than a valid URL.

## Task 1: Extend The Analytics Boundary

**Files:**

- Modify: `src/v2/shared/lib/analytics.ts`
- Modify: `src/v2/shared/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Write failing analytics tests**

Modify the import in `src/v2/shared/lib/__tests__/analytics.test.ts` so it includes the new helpers:

```ts
import {
  createAnalyticsBatchId,
  toBatchEventData,
  toListingFailureEventData,
  toUnsupportedInputFailureInput,
  trackBatchStarted,
  trackListingFailed,
  trackUnsupportedInputFailure,
} from '../analytics'
```

Add these tests inside `describe('analytics payload builders', () => { ... })`:

```ts
it('builds a bounded unsupported input failure payload', () => {
  const failure = toUnsupportedInputFailureInput({
    batchId: 'batch-unsupported',
    rawInput: '  DetailView.asp?ShopNo=30195108\n\tabc...  ',
    elapsedMs: 12,
  })

  expect(failure).toEqual({
    batchId: 'batch-unsupported',
    failureStage: 'invalid_url',
    failureReason: 'unsupported_input',
    listingUrl: 'DetailView.asp?ShopNo=30195108 abc...',
    inputWasTruncated: false,
    elapsedMs: 12,
  })
  expect(toListingFailureEventData(failure!)).toEqual({
    batch_id: 'batch-unsupported',
    failure_stage: 'invalid_url',
    failure_reason: 'unsupported_input',
    listing_url: 'DetailView.asp?ShopNo=30195108 abc...',
    input_was_truncated: false,
    elapsed_ms: 12,
  })
})

it('truncates unsupported input samples to 160 characters', () => {
  const rawInput = `DetailView.asp?${'x'.repeat(200)}`
  const failure = toUnsupportedInputFailureInput({
    batchId: 'batch-long',
    rawInput,
    elapsedMs: 20,
  })

  expect(failure?.listingUrl).toBe(rawInput.slice(0, 160))
  expect(failure?.listingUrl).toHaveLength(160)
  expect(failure?.inputWasTruncated).toBe(true)
})

it('does not build unsupported input payloads for empty samples', () => {
  expect(
    toUnsupportedInputFailureInput({
      batchId: 'batch-empty',
      rawInput: ' \n\t ',
      elapsedMs: 1,
    })
  ).toBeNull()
})
```

Add these tests inside `describe('analytics tracking', () => { ... })`:

```ts
it('tracks unsupported input through the listing_failed event', () => {
  const track = vi.fn()
  stubWindow({ umami: { track } })

  trackUnsupportedInputFailure({
    batchId: 'batch-unsupported',
    rawInput: '  DetailView.asp?ShopNo=1\nabc...  ',
    elapsedMs: 7,
  })

  expect(track).toHaveBeenCalledWith('listing_failed', {
    batch_id: 'batch-unsupported',
    failure_stage: 'invalid_url',
    failure_reason: 'unsupported_input',
    listing_url: 'DetailView.asp?ShopNo=1 abc...',
    input_was_truncated: false,
    elapsed_ms: 7,
  })
})

it('does not send unsupported input events for empty samples', () => {
  const track = vi.fn()
  stubWindow({ umami: { track } })

  trackUnsupportedInputFailure({
    batchId: 'batch-empty',
    rawInput: ' \n\t ',
    elapsedMs: 0,
  })

  expect(track).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the analytics tests to verify they fail**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: FAIL because `toUnsupportedInputFailureInput` and `trackUnsupportedInputFailure` do not exist yet.

- [ ] **Step 3: Implement unsupported input payload helpers**

Modify `src/v2/shared/lib/analytics.ts`.

Update `ListingFailureAnalyticsInput`:

```ts
export interface ListingFailureAnalyticsInput {
  batchId: string
  failureStage: FailureStage
  failureReason: string
  listingUrl: string
  vehicleNumber?: string
  vehicleName?: string
  imageCount?: number
  inputWasTruncated?: boolean
  elapsedMs: number
}
```

Add this interface and constants below `ListingFailureAnalyticsInput`:

```ts
export interface UnsupportedInputFailureAnalyticsInput {
  batchId: string
  rawInput: string
  elapsedMs: number
}

const unsupportedInputFailureReason = 'unsupported_input'
const unsupportedInputSampleMaxLength = 160
const whitespacePattern = /\s+/g
```

Update `toListingFailureEventData` so it includes the optional truncation flag:

```ts
export function toListingFailureEventData(input: ListingFailureAnalyticsInput) {
  return compactEventData({
    batch_id: input.batchId,
    failure_stage: input.failureStage,
    failure_reason: input.failureReason,
    listing_url: input.listingUrl,
    vehicle_number: input.vehicleNumber,
    vehicle_name: input.vehicleName,
    image_count: input.imageCount,
    input_was_truncated: input.inputWasTruncated,
    elapsed_ms: input.elapsedMs,
  })
}
```

Add this helper below `toListingFailureEventData`:

```ts
export function toUnsupportedInputFailureInput({
  batchId,
  rawInput,
  elapsedMs,
}: UnsupportedInputFailureAnalyticsInput): ListingFailureAnalyticsInput | null {
  const normalizedInput = rawInput.trim().replace(whitespacePattern, ' ')

  if (normalizedInput.length === 0) {
    return null
  }

  return {
    batchId,
    failureStage: 'invalid_url',
    failureReason: unsupportedInputFailureReason,
    listingUrl: normalizedInput.slice(0, unsupportedInputSampleMaxLength),
    inputWasTruncated: normalizedInput.length > unsupportedInputSampleMaxLength,
    elapsedMs,
  }
}
```

Add this tracker below `trackListingFailed`:

```ts
export const trackUnsupportedInputFailure = (input: UnsupportedInputFailureAnalyticsInput) => {
  const failureInput = toUnsupportedInputFailureInput(input)

  if (!failureInput) {
    return
  }

  trackListingFailed(failureInput)
}
```

- [ ] **Step 4: Run the analytics tests to verify they pass**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the analytics boundary**

Run:

```bash
git add src/v2/shared/lib/analytics.ts src/v2/shared/lib/__tests__/analytics.test.ts
git commit -m "feat: 지원하지 않는 입력 분석 래퍼 추가"
```

## Task 2: Connect Unsupported Input Tracking To The Paste Flow

**Files:**

- Modify: `src/app/truck-harvester-app.tsx`
- Modify: `src/app/__tests__/truck-harvester-app.test.tsx`

- [ ] **Step 1: Write failing app integration tests**

Modify `analyticsMocks` in `src/app/__tests__/truck-harvester-app.test.tsx`:

```ts
const analyticsMocks = vi.hoisted(() => ({
  createAnalyticsBatchId: vi.fn(() => 'batch-1'),
  trackBatchStarted: vi.fn(),
  trackListingFailed: vi.fn(),
  trackPreviewCompleted: vi.fn(),
  trackSaveCompleted: vi.fn(),
  trackSaveFailed: vi.fn(),
  trackSaveStarted: vi.fn(),
  trackUnsupportedInputFailure: vi.fn(),
}))
```

Add these tests near the existing analytics tests:

```tsx
it('tracks unsupported non-empty pasted input once without starting preview', async () => {
  const unsupportedInput =
    '  DetailView.asp?ShopNo=30195108&MemberNo=1000294965&OnCarNo=2026300055501\nabc...  '

  installDom({} as WritableDirectoryHandle)
  await renderTruckHarvesterApp()

  await pasteListingText(unsupportedInput)
  await flushAsyncUi(2)

  expect(analyticsMocks.createAnalyticsBatchId).toHaveBeenCalledTimes(1)
  expect(analyticsMocks.trackUnsupportedInputFailure).toHaveBeenCalledTimes(1)
  expect(analyticsMocks.trackUnsupportedInputFailure).toHaveBeenCalledWith({
    batchId: 'batch-1',
    rawInput: unsupportedInput,
    elapsedMs: expect.any(Number),
  })
  expect(listingPreparationMocks.prepareListingUrls).not.toHaveBeenCalled()
  expect(analyticsMocks.trackBatchStarted).not.toHaveBeenCalled()
  expect(analyticsMocks.trackPreviewCompleted).not.toHaveBeenCalled()
  expect(container?.textContent).toContain(
    '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.'
  )
})

it('does not track empty pasted input as an unsupported input failure', async () => {
  installDom({} as WritableDirectoryHandle)
  await renderTruckHarvesterApp()

  await pasteListingText(' \n\t ')
  await flushAsyncUi(2)

  expect(analyticsMocks.createAnalyticsBatchId).not.toHaveBeenCalled()
  expect(analyticsMocks.trackUnsupportedInputFailure).not.toHaveBeenCalled()
  expect(listingPreparationMocks.prepareListingUrls).not.toHaveBeenCalled()
  expect(container?.textContent).toContain(
    '매물 주소를 찾지 못했어요. 복사한 내용을 다시 확인해 주세요.'
  )
})

it('does not track surrounding prose as unsupported input when a valid listing url is present', async () => {
  const truckUrl = 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=21'

  installDom({} as WritableDirectoryHandle)
  mockParseResponses([createTruckListing(truckUrl)])
  await renderTruckHarvesterApp()

  await pasteListingText(`확인 부탁드립니다\n${truckUrl}\nabc...`)
  await flushAsyncUi(4)

  expect(analyticsMocks.trackUnsupportedInputFailure).not.toHaveBeenCalled()
  expect(listingPreparationMocks.prepareListingUrls).toHaveBeenCalledTimes(1)
  expect(analyticsMocks.trackBatchStarted).toHaveBeenCalledWith(
    expect.objectContaining({
      batchId: 'batch-1',
      urlCount: 1,
      uniqueUrlCount: 1,
    })
  )
})
```

- [ ] **Step 2: Run the app tests to verify they fail**

Run:

```bash
bun run test -- --run src/app/__tests__/truck-harvester-app.test.tsx
```

Expected: FAIL because `trackUnsupportedInputFailure` is not called from `TruckHarvesterApp`.

- [ ] **Step 3: Import the unsupported input tracker**

Modify the analytics import in `src/app/truck-harvester-app.tsx`:

```ts
import {
  createAnalyticsBatchId,
  trackBatchStarted,
  trackListingFailed,
  trackPreviewCompleted,
  trackSaveCompleted,
  trackSaveFailed,
  trackSaveStarted,
  trackUnsupportedInputFailure,
  type SaveMethod,
} from '@/v2/shared/lib/analytics'
```

- [ ] **Step 4: Delegate parse failures to the analytics boundary**

Modify the beginning of `handlePasteText` in `src/app/truck-harvester-app.tsx`:

```ts
  const handlePasteText = (text: string) => {
    const pasteStartedAt = getAnalyticsNow()
    const pasteSequence = pasteSequenceRef.current + 1
    pasteSequenceRef.current = pasteSequence
    const result = parseUrlInputText(text)

    if (!result.success) {
      if (text.trim().length > 0) {
        trackUnsupportedInputFailure({
          batchId: createAnalyticsBatchId(),
          rawInput: text,
          elapsedMs: getAnalyticsDuration(pasteStartedAt),
        })
      }

      if (isMountedRef.current && pasteSequenceRef.current === pasteSequence) {
        setDuplicateMessage(result.message)
      }
      return
    }
```

Do not change `parseUrlInputText`, `ListingChipInput`, or the existing user-facing copy.

- [ ] **Step 5: Run the app tests to verify they pass**

Run:

```bash
bun run test -- --run src/app/__tests__/truck-harvester-app.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run the URL input parser tests to protect business logic boundaries**

Run:

```bash
bun run test -- --run src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts
```

Expected: PASS, proving unsupported inputs still fail extraction and valid URLs still succeed without analytics knowledge in the parser.

- [ ] **Step 7: Commit the paste-flow integration**

Run:

```bash
git add src/app/truck-harvester-app.tsx src/app/__tests__/truck-harvester-app.test.tsx
git commit -m "feat: 지원하지 않는 입력 실패 계측 추가"
```

## Task 3: Update Analytics Documentation

**Files:**

- Modify: `docs/superpowers/specs/2026-04-29-umami-analytics-design.md`
- Modify: `docs/architecture.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the original Umami design contract**

Modify the `listing_failed` description in `docs/superpowers/specs/2026-04-29-umami-analytics-design.md`:

```md
확인 실패, 무효 주소, 지원하지 않는 입력, 저장 실패가 발생한 매물 단위
상세 이벤트다. 지원하지 않는 입력은 매물 후보를 하나도 추출하지 못한
비어 있지 않은 붙여넣기를 뜻하며, 붙여넣기 1회당 최대 1건만 전송한다.
```

Modify the failure payload property list:

```md
- `listing_url`: 실패한 실제 URL. `failure_stage=invalid_url`이고
  `failure_reason=unsupported_input`인 경우에는 사용자가 붙여넣은 입력 샘플일
  수 있다.
- `input_was_truncated`: 지원하지 않는 입력 샘플이 160자를 넘어 잘렸는지 여부
```

Add this paragraph after the list:

```md
지원하지 않는 입력 샘플은 앞뒤 공백을 제거하고 연속 공백을 한 칸으로 축약한 뒤
160자까지만 저장한다. 공백뿐인 입력은 실패 이벤트로 보내지 않는다.
```

Add `trackUnsupportedInputFailure` to the expected public functions list:

```md
- `trackUnsupportedInputFailure`
```

Add this bullet to operating notes:

```md
- 지원하지 않는 입력은 무료 플랜 사용량을 보호하기 위해 붙여넣기 1회당 최대
  `listing_failed` 1건만 남긴다.
```

- [ ] **Step 2: Update the architecture document**

Modify the Umami paragraph in `docs/architecture.md`:

```md
Umami Cloud analytics loads only in production with the fixed Truck Harvester
website script from Umami Cloud. The app records aggregate batch funnel events
for paste, preview, and save milestones. Only failed listings and non-empty
unsupported input failures send listing diagnostics such as listing URL,
bounded input sample, vehicle number, and vehicle name; successful listings are
represented by counts only. Unsupported input samples are whitespace-normalized,
capped at 160 characters, and sent at most once per failed paste.
```

- [ ] **Step 3: Update root agent guidance**

Modify the Umami scope rule in `AGENTS.md`:

```md
- Umami analytics may collect failed-listing URL, bounded unsupported input
  sample, vehicle number, and vehicle name only inside the approved
  failed-listing diagnostics event.
```

- [ ] **Step 4: Review docs for consistent wording**

Run:

```bash
rg -n "unsupported input|지원하지 않는 입력|input_was_truncated|listing_url" docs/superpowers/specs/2026-04-29-umami-analytics-design.md docs/architecture.md AGENTS.md
```

Expected: The three docs mention unsupported input only as a bounded failed-listing diagnostics case, not as a new event family.

- [ ] **Step 5: Commit the docs update**

Run:

```bash
git add docs/superpowers/specs/2026-04-29-umami-analytics-design.md docs/architecture.md AGENTS.md
git commit -m "docs: 지원하지 않는 입력 분석 경계 문서화"
```

## Task 4: Final Verification

**Files:**

- Verify only; no expected file modifications.

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/analytics.test.ts src/app/__tests__/truck-harvester-app.test.tsx src/v2/widgets/url-input/model/__tests__/url-input-schema.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Check formatting for changed files**

Run:

```bash
node_modules/.bin/prettier --check src/v2/shared/lib/analytics.ts src/v2/shared/lib/__tests__/analytics.test.ts src/app/truck-harvester-app.tsx src/app/__tests__/truck-harvester-app.test.tsx docs/superpowers/specs/2026-04-29-umami-analytics-design.md docs/architecture.md AGENTS.md
```

Expected: PASS.

Do not use the full `bun run format:check` result as the only signal until the existing unrelated formatting warnings in `src/app/apple-icon.tsx`, `src/app/icon.tsx`, and `src/app/opengraph-image.tsx` are cleaned up.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git status --short
git log --oneline -3
git show --stat --oneline HEAD~3..HEAD
```

Expected:

- Working tree is clean.
- The three newest commits match the planned analytics, paste-flow, and docs commits.
- No UI copy changed.
- No `parseUrlInputText` or `ListingChipInput` analytics coupling was introduced.
