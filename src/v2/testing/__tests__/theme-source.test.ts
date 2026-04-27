import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('theme source boundary', () => {
  it('uses the local shadcn Tailwind preset instead of the CLI package import', () => {
    const theme = read('src/app/theme.css')

    expect(theme).toContain("@import './shadcn-tailwind.css';")
    expect(theme).not.toContain("@import 'shadcn/tailwind.css';")
  })

  it('vendors the required shadcn Tailwind preset utilities', () => {
    const preset = read('src/app/shadcn-tailwind.css')

    expect(preset).toContain('@custom-variant data-open')
    expect(preset).toContain('@utility no-scrollbar')
  })
})
