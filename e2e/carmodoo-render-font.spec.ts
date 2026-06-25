import { expect, test, type Browser, type Page } from '@playwright/test'

import { renderCarmodooNativeImagesWithBrowser } from '../src/v2/features/file-management/server/carmodoo-native-renderer'

const koreanGlyphFixtureText = '자동차성능상태점검기록부'

function createCarmodooGlyphFixtureUrl() {
  const html = `<!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <style>
          html,
          body {
            background: #fff;
            margin: 0;
            padding: 0;
          }

          .repaircheck_box {
            background: #fff;
            color: #111;
            width: 1400px;
          }

          .page_wrap {
            background: #fff;
            height: 950px;
            overflow: hidden;
            width: 1400px;
          }

          .glyph_target {
            color: #111;
            font-size: 72px;
            font-weight: 700;
            line-height: 1.2;
            padding: 96px 80px;
          }
        </style>
      </head>
      <body>
        <main class="repaircheck_box">
          <section class="page_wrap">
            <div class="glyph_target">${koreanGlyphFixtureText}</div>
          </section>
        </main>
      </body>
    </html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

async function measureDarkPixels(page: Page, image: Uint8Array) {
  const imageUrl = `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}`

  return page.evaluate(async (src) => {
    const image = new Image()
    image.decoding = 'sync'
    image.src = src
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas context is not available.')
    }

    context.drawImage(image, 0, 0)

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const columns = new Set<number>()
    const rows = new Set<number>()
    let darkPixels = 0

    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] ?? 0
      const red = pixels[index] ?? 255
      const green = pixels[index + 1] ?? 255
      const blue = pixels[index + 2] ?? 255

      if (alpha > 0 && red < 160 && green < 160 && blue < 160) {
        const pixelIndex = index / 4

        darkPixels += 1
        columns.add(pixelIndex % canvas.width)
        rows.add(Math.floor(pixelIndex / canvas.width))
      }
    }

    return {
      darkPixels,
      imageHeight: canvas.height,
      imageWidth: canvas.width,
      inkedColumns: columns.size,
      inkedRows: rows.size,
    }
  }, imageUrl)
}

test('Carmodoo renderer draws Korean glyphs into JPG pixels', async ({
  browser,
  page,
}) => {
  const images = await renderCarmodooNativeImagesWithBrowser(
    browser as Browser as Parameters<
      typeof renderCarmodooNativeImagesWithBrowser
    >[0],
    createCarmodooGlyphFixtureUrl(),
    {
      origin: 'http://localhost',
      timeoutMs: 15_000,
    }
  )

  expect(images).toHaveLength(1)

  const metrics = await measureDarkPixels(page, images[0]!)

  expect(metrics.imageWidth).toBeGreaterThanOrEqual(1400)
  expect(metrics.imageHeight).toBeGreaterThanOrEqual(950)
  expect(metrics.darkPixels).toBeGreaterThan(2_000)
  expect(metrics.inkedColumns).toBeGreaterThan(500)
  expect(metrics.inkedRows).toBeGreaterThan(60)
})
