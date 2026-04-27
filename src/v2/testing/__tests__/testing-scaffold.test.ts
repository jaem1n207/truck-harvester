import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readText = (path: string) => readFileSync(path, 'utf8')
const legacyLocalV2Url = ['localhost:3000', '/v2'].join('')

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

  it('keeps Vitest coverage focused on root app and v2 internals', () => {
    const config = readText('vitest.config.ts')

    expect(config).toContain(
      "include: ['src/app/**/*.{ts,tsx}', 'src/v2/**/*.{ts,tsx}']"
    )
    expect(config).not.toContain('src/shared/lib/test-setup')
    expect(config).toContain('lines: 80')
  })

  it('runs Playwright against the root route', () => {
    const config = readText('playwright.config.ts')

    expect(config).toContain("baseURL: 'http://localhost:3000'")
    expect(config).toContain("url: 'http://localhost:3000'")
    expect(config).not.toContain(legacyLocalV2Url)
  })

  it('defines the Playwright project and first happy-path spec', () => {
    const config = readText('playwright.config.ts')
    const spec = readText('e2e/happy-path-batch.spec.ts')

    expect(config).toContain("name: 'chromium'")
    expect(spec).toContain('completes a 10-address batch')
  })
})
