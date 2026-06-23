# SmartStore Manuscript Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save manuscript files whose `기타사항` block contains the exact SmartStore table fields staff need: `차명`, `연식`, `주행거리`, `차량번호`, and `차량정보`.

**Architecture:** Add a SmartStore table value object to the truck entity schema while keeping it optional at the API boundary for existing mocks and backward-compatible parsed payloads. The live truck-no1 HTML parser will always populate the value object from `년형 | 등록` and `상세설명`, and the file-management text generator will render only that value object, with a local fallback for old listing objects that do not carry it yet.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Zod, Cheerio, Vitest, JSZip, File System Access API test doubles.

---

## File Structure

- Modify `src/v2/entities/truck/model.ts`
  - Owns `smartStoreTableSchema` and the exported `SmartStoreTable` type.
  - Keeps `smartStoreTable` optional in `truckListingSchema` so older mocks and API payloads remain parseable.
- Modify `src/v2/entities/truck/__tests__/model.test.ts`
  - Verifies the new value object shape and preserves existing legacy listing parsing.
- Modify `src/v2/shared/lib/parse-truck-html.ts`
  - Extracts `최초등록`, `차명`, `상부`, and `하부` from truck-no1 HTML.
  - Produces a `smartStoreTable` value on every live parsed listing.
- Modify `src/v2/shared/lib/__tests__/parse-truck-html.test.ts`
  - Covers the 822수2698 full-detail case, empty `차명/상부/하부`, one-sided `상부/하부`, and invalid registration fallback.
- Modify `src/v2/features/file-management/text-content.ts`
  - Renders the new indented `기타사항` block.
  - Builds a safe fallback table if a listing lacks `smartStoreTable`.
- Create `src/v2/features/file-management/__tests__/text-content.test.ts`
  - Tests the manuscript text directly without file-system mocks.
- Modify `src/v2/features/file-management/__tests__/file-system.test.ts`
  - Verifies directory-save manuscripts include the new block.
- Modify `src/v2/features/file-management/__tests__/zip-fallback.test.ts`
  - Verifies ZIP manuscripts include the same block.
- Modify `e2e/truck-fixtures.ts`
  - Keeps mocked E2E parse responses realistic by including `smartStoreTable`.

## Task 1: Entity Contract

**Files:**

- Modify: `src/v2/entities/truck/model.ts`
- Modify: `src/v2/entities/truck/__tests__/model.test.ts`

- [ ] **Step 1: Write the failing entity schema test**

Add this constant after the existing `listing` object in `src/v2/entities/truck/__tests__/model.test.ts`:

```ts
const smartStoreTable = {
  vehicleName: '포터2 1.3톤활어운반차',
  registrationLabel: '2023년 11월 등록',
  mileage: '159,600km',
  vehicleNumber: '822수2698',
  upperInfo: '인증차(바로1.3톤활어운반차), 액산병 보유',
  lowerInfo: '1인신조, 무사고, 오토미션',
  hasVehicleInfo: true,
}
```

Add this test inside `describe('truckListingSchema', () => { ... })`:

```ts
it('parses smart store table details when present', () => {
  const parsed = truckListingSchema.parse({
    ...listing,
    smartStoreTable,
  })

  expect(parsed.smartStoreTable).toEqual(smartStoreTable)
})
```

Add this test to prove old payloads still parse:

```ts
it('allows existing listing payloads without smart store table details', () => {
  const parsed = truckListingSchema.parse(listing)

  expect(parsed.smartStoreTable).toBeUndefined()
})
```

- [ ] **Step 2: Run the entity test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/entities/truck/__tests__/model.test.ts
```

Expected: FAIL with a Zod stripped-field style assertion because `smartStoreTable` is not in `truckListingSchema`, so `parsed.smartStoreTable` is `undefined` even when the input contains it.

- [ ] **Step 3: Add the schema and type**

In `src/v2/entities/truck/model.ts`, add this schema after `truckPriceSchema`:

```ts
export const smartStoreTableSchema = z.object({
  vehicleName: z.string().min(1),
  registrationLabel: z.string().min(1),
  mileage: z.string().min(1),
  vehicleNumber: z.string().min(1),
  upperInfo: z.string().min(1),
  lowerInfo: z.string().min(1),
  hasVehicleInfo: z.boolean(),
})
```

Then add the field to `truckListingSchema` after `options`:

```ts
  options: z.string().min(1),
  smartStoreTable: smartStoreTableSchema.optional(),
  images: z.array(z.string().url()).default([]),
```

Export the type near the existing type exports:

```ts
export type SmartStoreTable = z.infer<typeof smartStoreTableSchema>
```

- [ ] **Step 4: Run the entity test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/entities/truck/__tests__/model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the entity contract**

Run:

```bash
git add src/v2/entities/truck/model.ts src/v2/entities/truck/__tests__/model.test.ts
git commit -m "feat: 스마트스토어 원고 표 계약 추가"
```

## Task 2: Parser Extraction

**Files:**

- Modify: `src/v2/shared/lib/parse-truck-html.ts`
- Modify: `src/v2/shared/lib/__tests__/parse-truck-html.test.ts`

- [ ] **Step 1: Update the parser fixture for full SmartStore details**

In `src/v2/shared/lib/__tests__/parse-truck-html.test.ts`, replace the `car-detail` block inside `fullHtml` with:

```html
<div class="car-detail">
  <dl>
    <dt>년형 | 등록</dt>
    <dd>
      <strong class="number">2023</strong>년형 | <span class="number">20231117</span> 최초등록
    </dd>
    <dt>주행거리</dt>
    <dd><strong class="red number">159,600</strong>km</dd>
  </dl>
</div>
```

Replace the `vcontent` block inside `fullHtml` with:

```html
<div class="vcontent">
  ▶ 추가장착 옵션 :: 1.3톤활어운반차, 포터2, 오토미션, 바로특장, 1.3톤인증차, 1인신조, 무사고,
  액산병 보유<br /><br /><br />
  ▶ 상세설명 ::
  <p>
    <font
      ><span
        ><b><span>·&nbsp;차명: 포터2 1.3톤활어운반차</span></b></span
      ></font
    >
  </p>
  <p>
    <b><span>·&nbsp;</span></b
    ><font
      ><span
        ><b><span>상부: 인증차(</span></b></span
      ><span><b>바로1.3톤활어운반차</b></span></font
    ><b><span>), 액산병 보유</span></b>
  </p>
  <p>
    <b><span>·&nbsp;</span></b
    ><font
      ><span
        ><b><span>하부: 1인신조, 무사고, 오토미션</span></b></span
      ></font
    >
  </p>
</div>
```

Update the expected listing in `it('extracts truck listing fields using the legacy selectors', ...)`:

```ts
year: '2023',
mileage: '159,600km',
options:
  '1.3톤활어운반차 / 포터2 / 오토미션 / 바로특장 / 1.3톤인증차 / 1인신조 / 무사고 / 액산병 보유',
smartStoreTable: {
  vehicleName: '포터2 1.3톤활어운반차',
  registrationLabel: '2023년 11월 등록',
  mileage: '159,600km',
  vehicleNumber: '12가3456',
  upperInfo: '인증차(바로1.3톤활어운반차), 액산병 보유',
  lowerInfo: '1인신조, 무사고, 오토미션',
  hasVehicleInfo: true,
},
```

- [ ] **Step 2: Add parser tests for empty and one-sided detail rows**

Add this fixture after `sparseHtml`:

```ts
const emptyDetailHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">냉동탑 5톤이상</p>
    <p class="vnumber">91누5384</p>
    <p class="vcash"><span class="red">12,500</span>만원</p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2021</strong>년형 | <span class="number">20210823</span> 최초등록</dd>
        <dt>주행거리</dt>
        <dd><strong class="red number">363,313</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      ▶ 추가장착 옵션 :: <br /><br /><br />
      ▶ 상세설명 ::
      <p><font><span><b><span>·&nbsp;차명:</span></b></span></font></p>
      <p><b><span>·&nbsp;</span></b><font><span><b><span>상부:</span></b></span></font></p>
      <p><b><span>·&nbsp;</span></b><font><span><b><span>하부:</span></b></span></font></p>
    </div>
  </body>
</html>
`

const partialVehicleInfoHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">현대 포터2</p>
    <p class="vnumber">88다8888</p>
    <p class="vcash"><span class="red">2,000</span>만원</p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2022</strong>년형 | <span class="number">20220501</span> 최초등록</dd>
        <dt>주행거리</dt>
        <dd><strong class="red number">50,000</strong>km</dd>
      </dl>
    </div>
    <div class="vcontent">
      ▶ 상세설명 ::
      <p><span>· 차명: 포터2 특장차</span></p>
      <p><span>· 상부: 냉동탑</span></p>
      <p><span>· 하부:</span></p>
    </div>
  </body>
</html>
`

const invalidRegistrationHtml = `
<!DOCTYPE html>
<html>
  <body>
    <p class="vname">기아 봉고</p>
    <p class="vnumber">34나5678</p>
    <p class="vcash"><span class="red">900</span></p>
    <div class="car-detail">
      <dl>
        <dt>년형 | 등록</dt>
        <dd><strong class="number">2020</strong>년형 | <span class="number">20201340</span> 최초등록</dd>
      </dl>
    </div>
  </body>
</html>
`
```

Add these tests:

```ts
it('falls back when detail labels are present but empty', () => {
  const listing = parseTruckHtml(emptyDetailHtml, detailUrl)

  expect(listing.smartStoreTable).toEqual({
    vehicleName: '냉동탑 5톤이상',
    registrationLabel: '2021년 8월 등록',
    mileage: '363,313km',
    vehicleNumber: '91누5384',
    upperInfo: '정보 없음',
    lowerInfo: '정보 없음',
    hasVehicleInfo: false,
  })
})

it('keeps both upper and lower rows when only one vehicle info value exists', () => {
  const listing = parseTruckHtml(partialVehicleInfoHtml, detailUrl)

  expect(listing.smartStoreTable).toEqual({
    vehicleName: '포터2 특장차',
    registrationLabel: '2022년 5월 등록',
    mileage: '50,000km',
    vehicleNumber: '88다8888',
    upperInfo: '냉동탑',
    lowerInfo: '정보 없음',
    hasVehicleInfo: true,
  })
})

it('uses the existing year fallback when the initial registration date is invalid', () => {
  const listing = parseTruckHtml(invalidRegistrationHtml, detailUrl)

  expect(listing.smartStoreTable?.registrationLabel).toBe('2020')
})
```

- [ ] **Step 3: Run the parser test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/parse-truck-html.test.ts
```

Expected: FAIL because `parseTruckHtml()` does not yet return `smartStoreTable`.

- [ ] **Step 4: Implement parser helpers**

In `src/v2/shared/lib/parse-truck-html.ts`, update the import:

```ts
import { truckListingSchema, type SmartStoreTable, type TruckListing } from '@/v2/entities/truck'
```

Add these helpers above `buildCompactPriceLabel()`:

```ts
const missingSmartStoreInfoLabel = '정보 없음'

function normalizeContentText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/^[\s·•]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCarDetailText($: ReturnType<typeof load>, label: string) {
  let detailText: string | undefined

  $('.car-detail dl dt').each((_, element) => {
    if (detailText) {
      return
    }

    const term = normalizeContentText($(element).text())

    if (term === label) {
      detailText = normalizeContentText($(element).next('dd').text())
    }
  })

  return detailText
}

function formatInitialRegistrationLabel(value: string | undefined) {
  const compactDate = value?.match(/(\d{8})\s*최초등록/)?.[1]

  if (!compactDate) {
    return undefined
  }

  const year = Number.parseInt(compactDate.slice(0, 4), 10)
  const month = Number.parseInt(compactDate.slice(4, 6), 10)
  const day = Number.parseInt(compactDate.slice(6, 8), 10)
  const parsedDate = new Date(year, month - 1, day)

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }

  return `${year}년 ${month}월 등록`
}

function extractVcontentField($: ReturnType<typeof load>, label: string) {
  const fieldPattern = new RegExp(`^${label}\\s*:\\s*(.*)$`)

  for (const element of $('.vcontent p').toArray()) {
    const normalizedText = normalizeContentText($(element).text())
    const match = normalizedText.match(fieldPattern)
    const value = normalizeContentText(match?.[1] ?? '')

    if (value) {
      return value
    }
  }

  return undefined
}

function buildSmartStoreTable({
  $,
  fallbackMileage,
  fallbackVehicleName,
  fallbackVehicleNumber,
  fallbackYear,
}: {
  $: ReturnType<typeof load>
  fallbackMileage: string
  fallbackVehicleName: string
  fallbackVehicleNumber: string
  fallbackYear: string
}): SmartStoreTable {
  const upperInfo = extractVcontentField($, '상부')
  const lowerInfo = extractVcontentField($, '하부')

  return {
    vehicleName: extractVcontentField($, '차명') ?? fallbackVehicleName,
    registrationLabel:
      formatInitialRegistrationLabel(getCarDetailText($, '년형 | 등록')) ?? fallbackYear,
    mileage: fallbackMileage,
    vehicleNumber: fallbackVehicleNumber,
    upperInfo: upperInfo ?? missingSmartStoreInfoLabel,
    lowerInfo: lowerInfo ?? missingSmartStoreInfoLabel,
    hasVehicleInfo: Boolean(upperInfo || lowerInfo),
  }
}
```

Replace the old `extractedVehicleName` loop with:

```ts
const extractedVehicleName = extractVcontentField($, '차명')
```

In the return object, add `smartStoreTable` after `options`:

```ts
    options,
    smartStoreTable: buildSmartStoreTable({
      $,
      fallbackMileage: mileage,
      fallbackVehicleName: extractedVehicleName || vname,
      fallbackVehicleNumber: vnumber,
      fallbackYear: year,
    }),
    images: Array.from(new Set(images)),
```

- [ ] **Step 5: Run the parser test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/shared/lib/__tests__/parse-truck-html.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit parser extraction**

Run:

```bash
git add src/v2/shared/lib/parse-truck-html.ts src/v2/shared/lib/__tests__/parse-truck-html.test.ts
git commit -m "feat: 스마트스토어 원고 표 정보 추출"
```

## Task 3: Manuscript Text Rendering

**Files:**

- Modify: `src/v2/features/file-management/text-content.ts`
- Create: `src/v2/features/file-management/__tests__/text-content.test.ts`

- [ ] **Step 1: Write focused text-content tests**

Create `src/v2/features/file-management/__tests__/text-content.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { type TruckListing } from '@/v2/entities/truck'

import { buildTruckTextContent } from '../text-content'

const listing: TruckListing = {
  url: 'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3',
  vname: '[활어차]포터2 슈퍼캡/초장축/(CRDi)',
  vehicleName: '포터2 1.3톤활어운반차',
  vnumber: '822수2698',
  price: {
    raw: 2850,
    rawWon: 28500000,
    label: '2,850만원',
    compactLabel: '2.9천만',
  },
  year: '2023',
  mileage: '159,600km',
  options:
    '1.3톤활어운반차 / 포터2 / 오토미션 / 바로특장 / 1.3톤인증차 / 1인신조 / 무사고 / 액산병 보유',
  smartStoreTable: {
    vehicleName: '포터2 1.3톤활어운반차',
    registrationLabel: '2023년 11월 등록',
    mileage: '159,600km',
    vehicleNumber: '822수2698',
    upperInfo: '인증차(바로1.3톤활어운반차), 액산병 보유',
    lowerInfo: '1인신조, 무사고, 오토미션',
    hasVehicleInfo: true,
  },
  images: ['https://img.example.com/one.jpg'],
}

describe('buildTruckTextContent', () => {
  it('renders an indented smart store table block inside 기타사항', () => {
    const content = buildTruckTextContent(listing)

    expect(content).toContain(`기타사항 :
  차명 : 포터2 1.3톤활어운반차
  연식 : 2023년 11월 등록
  주행거리 : 159,600km
  차량번호 : 822수2698
  차량정보 :
    상부 : 인증차(바로1.3톤활어운반차), 액산병 보유
    하부 : 1인신조, 무사고, 오토미션`)
    expect(content).not.toContain('기타사항 :  1.3톤활어운반차')
  })

  it('renders vehicle info as one line when upper and lower details are empty', () => {
    const content = buildTruckTextContent({
      ...listing,
      smartStoreTable: {
        vehicleName: '냉동탑 5톤이상',
        registrationLabel: '2021년 8월 등록',
        mileage: '363,313km',
        vehicleNumber: '91누5384',
        upperInfo: '정보 없음',
        lowerInfo: '정보 없음',
        hasVehicleInfo: false,
      },
    })

    expect(content).toContain(`기타사항 :
  차명 : 냉동탑 5톤이상
  연식 : 2021년 8월 등록
  주행거리 : 363,313km
  차량번호 : 91누5384
  차량정보 : 정보 없음`)
    expect(content).not.toContain('추가장착 옵션 : 정보 없음')
  })

  it('keeps both upper and lower rows when only one value is present', () => {
    const content = buildTruckTextContent({
      ...listing,
      smartStoreTable: {
        vehicleName: '포터2 특장차',
        registrationLabel: '2023년 11월 등록',
        mileage: '159,600km',
        vehicleNumber: '822수2698',
        upperInfo: '냉동탑',
        lowerInfo: '정보 없음',
        hasVehicleInfo: true,
      },
    })

    expect(content).toContain(`  차량정보 :
    상부 : 냉동탑
    하부 : 정보 없음`)
  })

  it('builds a safe table fallback when a legacy listing lacks smartStoreTable', () => {
    const { smartStoreTable: _unused, ...legacyListing } = listing
    const content = buildTruckTextContent(legacyListing)

    expect(content).toContain(`기타사항 :
  차명 : 포터2 1.3톤활어운반차
  연식 : 2023
  주행거리 : 159,600km
  차량번호 : 822수2698
  차량정보 : 정보 없음`)
  })
})
```

- [ ] **Step 2: Run the text-content test and verify it fails**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/text-content.test.ts
```

Expected: FAIL because `buildTruckTextContent()` still renders `기타사항 :  ${truck.options}`.

- [ ] **Step 3: Implement manuscript rendering**

In `src/v2/features/file-management/text-content.ts`, update the import:

```ts
import { type SmartStoreTable, type TruckListing } from '@/v2/entities/truck'
```

Add these helpers above `buildTruckTextContent()`:

```ts
const missingSmartStoreInfoLabel = '정보 없음'

function buildFallbackSmartStoreTable(truck: TruckListing): SmartStoreTable {
  return {
    vehicleName: truck.vehicleName,
    registrationLabel: truck.year,
    mileage: truck.mileage,
    vehicleNumber: truck.vnumber,
    upperInfo: missingSmartStoreInfoLabel,
    lowerInfo: missingSmartStoreInfoLabel,
    hasVehicleInfo: false,
  }
}

function buildSmartStoreTableDetails(table: SmartStoreTable) {
  const baseRows = [
    `  차명 : ${table.vehicleName}`,
    `  연식 : ${table.registrationLabel}`,
    `  주행거리 : ${table.mileage}`,
    `  차량번호 : ${table.vehicleNumber}`,
  ]

  if (!table.hasVehicleInfo) {
    return [...baseRows, `  차량정보 : ${missingSmartStoreInfoLabel}`].join('\n')
  }

  return [
    ...baseRows,
    '  차량정보 :',
    `    상부 : ${table.upperInfo}`,
    `    하부 : ${table.lowerInfo}`,
  ].join('\n')
}
```

Inside `buildTruckTextContent()`, add:

```ts
const smartStoreDetails = buildSmartStoreTableDetails(
  truck.smartStoreTable ?? buildFallbackSmartStoreTable(truck)
)
```

Replace the current `기타사항` line:

```ts
기타사항 :  ${truck.options}
```

with:

```ts
기타사항 :
${smartStoreDetails}
```

- [ ] **Step 4: Run the text-content test and verify it passes**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/text-content.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit manuscript rendering**

Run:

```bash
git add src/v2/features/file-management/text-content.ts src/v2/features/file-management/__tests__/text-content.test.ts
git commit -m "feat: 원고 기타사항 표 형식 출력"
```

## Task 4: Save Path Integration Tests

**Files:**

- Modify: `src/v2/features/file-management/__tests__/file-system.test.ts`
- Modify: `src/v2/features/file-management/__tests__/zip-fallback.test.ts`
- Modify: `e2e/truck-fixtures.ts`

- [ ] **Step 1: Add smartStoreTable to the file-system test fixture**

In `src/v2/features/file-management/__tests__/file-system.test.ts`, add this field to the top-level `listing` object after `options`:

```ts
  smartStoreTable: {
    vehicleName: '2020년 현대 마이티',
    registrationLabel: '2020년 6월 등록',
    mileage: '150,000km',
    vehicleNumber: '12가/3456',
    upperInfo: '냉동탑',
    lowerInfo: '후방카메라',
    hasVehicleInfo: true,
  },
```

In the `saves vehicle images, performance check images, and manuscript into structured folders` test, add this assertion after the existing manuscript `차량번호` assertion:

```ts
await expect(writables.get('12가_3456/원고/12가_3456 원고.txt')!.write).toHaveBeenCalledWith(
  expect.stringContaining(`기타사항 :
  차명 : 2020년 현대 마이티
  연식 : 2020년 6월 등록
  주행거리 : 150,000km
  차량번호 : 12가/3456
  차량정보 :
    상부 : 냉동탑
    하부 : 후방카메라`)
)
```

In the `treats performance check capture failure as non-fatal and still writes manuscript` test, add:

```ts
await expect(writables.get('12가_3456/원고/12가_3456 원고.txt')!.write).toHaveBeenCalledWith(
  expect.stringContaining('  차량정보 :')
)
```

- [ ] **Step 2: Add smartStoreTable to the ZIP test fixture**

In `src/v2/features/file-management/__tests__/zip-fallback.test.ts`, add this field to the top-level `listing` object after `options`:

```ts
  smartStoreTable: {
    vehicleName: '2020년 현대 마이티',
    registrationLabel: '2020년 6월 등록',
    mileage: '150,000km',
    vehicleNumber: '12가/3456',
    upperInfo: '냉동탑',
    lowerInfo: '후방카메라',
    hasVehicleInfo: true,
  },
```

In the `creates an archive with structured folders and save results` test, add:

```ts
await expect(zip.file('12가_3456/원고/12가_3456 원고.txt')!.async('string')).resolves
  .toContain(`기타사항 :
  차명 : 2020년 현대 마이티
  연식 : 2020년 6월 등록
  주행거리 : 150,000km
  차량번호 : 12가/3456
  차량정보 :
    상부 : 냉동탑
    하부 : 후방카메라`)
```

- [ ] **Step 3: Keep E2E parse fixtures realistic**

In `e2e/truck-fixtures.ts`, add this field to the object returned by `buildTruckListing()` after `options`:

```ts
  smartStoreTable: {
    vehicleName: `현대 메가트럭 냉동탑 ${index}`,
    registrationLabel: `20${19 + index}년 등록`,
    mileage: `${80_000 + index * 12_500}km`,
    vehicleNumber: `서울${String(index).padStart(2, '0')}가${1234 + index}`,
    upperInfo: '냉동탑',
    lowerInfo: '후방카메라',
    hasVehicleInfo: true,
  },
```

- [ ] **Step 4: Run file-management integration tests**

Run:

```bash
bun run test -- --run src/v2/features/file-management/__tests__/text-content.test.ts src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit integration coverage**

Run:

```bash
git add src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts e2e/truck-fixtures.ts
git commit -m "test: 스마트스토어 원고 저장 경로 검증"
```

## Task 5: Full Verification

**Files:**

- No new files. This task verifies the branch.

- [ ] **Step 1: Run focused regression tests**

Run:

```bash
bun run test -- --run src/v2/entities/truck/__tests__/model.test.ts src/v2/shared/lib/__tests__/parse-truck-html.test.ts src/v2/features/file-management/__tests__/text-content.test.ts src/v2/features/file-management/__tests__/file-system.test.ts src/v2/features/file-management/__tests__/zip-fallback.test.ts src/v2/features/truck-processing/__tests__/api.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS. `smartStoreTable` is optional at the schema boundary, so existing
typed fixtures that do not exercise manuscript text do not need to change.

- [ ] **Step 3: Run lint**

Run:

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 4: Run format check**

Run:

```bash
bun run format:check
```

Expected: PASS.

- [ ] **Step 5: Review history and working tree**

Run:

```bash
git status
git log --oneline -5
```

Expected: working tree clean, with these new commits near the top:

```text
test: 스마트스토어 원고 저장 경로 검증
feat: 원고 기타사항 표 형식 출력
feat: 스마트스토어 원고 표 정보 추출
feat: 스마트스토어 원고 표 계약 추가
```

## Self-Review Notes

- Spec coverage:
  - `smartStoreTable` contract is covered by Task 1.
  - `최초등록` date extraction and `yyyy년 m월 등록` formatting are covered by Task 2.
  - Empty `차명/상부/하부` fallback and one-sided `상부/하부` behavior are covered by Task 2 and Task 3.
  - Indented `기타사항` rendering is covered by Task 3.
  - Directory and ZIP saved manuscripts are covered by Task 4.
- Ambiguity scan:
  - The plan has no vague markers or unspecified implementation step.
  - Verification steps have concrete commands and expected results.
- Type consistency:
  - The plan consistently uses `SmartStoreTable`, `smartStoreTable`, `vehicleName`, `registrationLabel`, `mileage`, `vehicleNumber`, `upperInfo`, `lowerInfo`, and `hasVehicleInfo`.
