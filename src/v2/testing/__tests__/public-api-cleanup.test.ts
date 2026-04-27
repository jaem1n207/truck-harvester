import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('V2 public API cleanup', () => {
  it('exports only active URL input components', () => {
    const source = read('src/v2/widgets/url-input/index.ts')

    expect(source).toContain("export * from './model'")
    expect(source).toContain("export * from './ui/listing-chip-input'")
    expect(source).not.toContain('url-input-form')
    expect(source).not.toContain('url-list')
  })

  it('exports only the active prepared listing status panel', () => {
    const source = read('src/v2/widgets/processing-status/index.ts')

    expect(source).toBe("export * from './ui/prepared-listing-status'\n")
  })

  it('exports only active shared model state', () => {
    const source = read('src/v2/shared/model/index.ts')

    expect(source).toBe("export * from './onboarding-store'\n")
  })
})
