import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

const deletedPaths = [
  'src/app/api/parse-truck/route.ts',
  'src/app/api/network-test/route.ts',
  'src/app/api/sentry-error-handler.ts',
  'src/app/api/sentry-example-api/route.ts',
  'src/app/sentry-example-page/page.tsx',
  'src/instrumentation.ts',
  'src/instrumentation-client.ts',
  'sentry.server.config.ts',
  'sentry.edge.config.ts',
  'src/shared',
  'src/widgets',
  'public/watermark-1.png',
  'public/watermark-2.png',
  'public/watermark-3.png',
  'public/watermark-4.png',
  'public/watermark-5.png',
]

const sourceFiles = [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/truck-harvester-app.tsx',
  'src/app/global-error.tsx',
  'src/app/not-found.tsx',
]

describe('legacy cleanup boundary', () => {
  it('removes legacy runtime files and watermark assets', () => {
    for (const path of deletedPaths) {
      expect(existsSync(join(root, path)), path).toBe(false)
    }
  })

  it('keeps root runtime free of legacy imports and Sentry', () => {
    for (const path of sourceFiles) {
      const source = readFileSync(join(root, path), 'utf8')

      expect(source).not.toContain('@/shared')
      expect(source).not.toContain('@/widgets')
      expect(source).not.toContain('@sentry/nextjs')
      expect(source).not.toMatch(/Sentry|sentry/)
      expect(source).not.toMatch(/watermark|Watermark/)
    }
  })
})
