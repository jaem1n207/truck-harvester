import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readText = (path: string) => readFileSync(path, 'utf8')

describe('v2 testing scaffold', () => {
  it('exposes Playwright scripts for e2e and accessibility checks', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['test:e2e']).toBe('playwright test')
    expect(packageJson.scripts['test:e2e:ui']).toBe('playwright test --ui')
    expect(packageJson.scripts['test:a11y']).toBe(
      'playwright test e2e/a11y.spec.ts'
    )
  })

  it('configures v2 unit coverage thresholds', () => {
    const config = readText('vitest.config.ts')

    expect(config).toContain("include: ['src/v2/**/*.{ts,tsx}']")
    expect(config).toContain('lines: 80')
  })

  it('defines the v2 Playwright project and first happy-path spec', () => {
    const config = readText('playwright.config.ts')
    const spec = readText('e2e/happy-path-batch.spec.ts')

    expect(config).toContain("baseURL: 'http://localhost:3000/v2'")
    expect(config).toContain("name: 'chromium'")
    expect(spec).toContain('completes a 10-address batch')
  })
})
