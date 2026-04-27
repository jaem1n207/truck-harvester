import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const opengraphImagePath = resolve(currentDir, '../opengraph-image.tsx')

describe('Open Graph image styles', () => {
  it('does not use unsupported zIndex style properties', () => {
    const source = readFileSync(opengraphImagePath, 'utf8')

    expect(source).not.toMatch(/(?:^|[,{]\s*)zIndex\s*:/m)
  })
})
