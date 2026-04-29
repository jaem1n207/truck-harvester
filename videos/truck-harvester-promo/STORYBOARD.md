# Storyboard

**Format:** 1920x1080
**Duration:** 20.00s
**Audio:** Local generated 20-second warm underscore plus on-screen Korean claims. `narration.txt` preserves the optional voiceover script for later TTS regeneration.
**VO direction:** If regenerated, use a calm Korean voice with practical dealership back-office pace. Confident without advertising hype.
**Style basis:** `DESIGN.md`, clean captured app screenshots, warm Korean operations UI.

## Asset Audit

| Asset                                | Type                  | Assign to Beat | Role                                      |
| ------------------------------------ | --------------------- | -------------- | ----------------------------------------- |
| `capture/screenshots/clean-1920.png` | Product screenshot    | Beats 1, 2, 4  | Main app surface in tilted product frames |
| `capture/screenshots/scroll-000.png` | Onboarding screenshot | Beat 2         | Proof that controls teach themselves      |
| `capture/screenshots/portrait.png`   | Product screenshot    | Beat 5         | Secondary device-like panel for depth     |
| `capture/extracted/visible-text.txt` | Text capture          | All beats      | Korean product copy source                |

## BEAT 1 - ORDER FROM PASTE (0.00-4.00s)

**VO:** "주소 열 개를 복사해도, 작업은 흩어지지 않습니다."

**Concept:** The video opens with copied URLs drifting in like loose paperwork. The workspace enters calmly, and the mess snaps into three clean chips. The viewer should understand the central promise before seeing any feature list.

**Visual:** Warm background, floating URL strips, a tilted clean app screenshot, and three prepared-listing chips. A thin orange route line draws from chaos to order.

**Transition:** Blur-through into beat 2 at 3.65s.

## BEAT 2 - PASTE ONCE (4.00-8.00s)

**VO:** "트럭 매물 수집기는 매물 주소만 골라 확인하고,"

**Concept:** The address input panel becomes the hero. The onboarding screenshot slides in as proof that the interface explains itself in plain Korean.

**Visual:** Screenshot frame on the left, oversized textarea on the right, URL fragments dropping into it and turning into a green "확인 완료" state.

**Transition:** Push slide into beat 3 at 7.65s.

## BEAT 3 - TEN AT A TIME (8.00-12.00s)

**VO:** "차량별 폴더로 사진과 정보를 정리합니다."

**Concept:** Five concurrent lanes show speed without making the app feel technical. The key phrase is "10대 일괄 확인"; the concurrency detail is visual, not copy-heavy.

**Visual:** Ten listing chips arranged in two rows. Five active orange lanes pulse, then resolve to green ready states. A small status panel counts up to ten.

**Transition:** Warm light wipe into beat 4 at 11.65s.

## BEAT 4 - SAVE CLEANLY (12.00-16.00s)

**VO:** "실패한 매물은 따로 남기고, 준비된 매물은 바로 저장합니다."

**Concept:** The workflow becomes tangible: folder stacks and image files slide into vehicle-number folders, while one failed item remains recoverable.

**Visual:** Folder selector card, generated folders, image tiles, one "확인 필요" chip, and multiple saved badges. The orange action becomes a green completion state.

**Transition:** Gentle focus pull into beat 5 at 15.65s.

## BEAT 5 - CTA (16.00-20.00s)

**VO:** "반복되는 수집 업무를 조용히, 빠르게 끝내세요."

**Concept:** Return to the product name and the simplest promise. The final frame should feel ready to use, not like a poster.

**Visual:** Big Korean headline, product screenshot card, three promise pills, and one orange CTA. The CTA rests on the last second.

**Final:** Fade to warm background after 19.75s.

## Production Architecture

```text
truck-harvester-promo/
├── index.html
├── DESIGN.md
├── SCRIPT.md
├── STORYBOARD.md
├── narration.txt
├── underscore.wav
├── narration.txt
├── transcript.json
└── capture/
    ├── screenshots/
    └── extracted/
```
