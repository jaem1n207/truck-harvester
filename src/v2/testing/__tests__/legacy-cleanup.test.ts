import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

const deletedPaths = [
  'src/app/api/parse-truck/route.ts',
  'src/app/api/parse-truck/__tests__/route.test.ts',
  'src/app/api/network-test/route.ts',
  'src/app/api/sentry-error-handler.ts',
  'src/app/api/sentry-example-api/route.ts',
  'src/app/sentry-example-page/page.tsx',
  'src/app/v2/AGENTS.md',
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

const sourceRoots = ['src/app', 'src/v2']

const isRuntimeSourceFile = (path: string) => {
  return (
    (path.endsWith('.ts') || path.endsWith('.tsx')) &&
    !path.includes('/__tests__/') &&
    !path.endsWith('.test.ts') &&
    !path.endsWith('.test.tsx') &&
    !path.endsWith('AGENTS.md')
  )
}

const collectRuntimeSourceFiles = (path: string): string[] => {
  const stats = statSync(path)

  if (stats.isFile()) {
    return isRuntimeSourceFile(path) ? [path] : []
  }

  if (!stats.isDirectory()) {
    return []
  }

  return readdirSync(path)
    .flatMap((entry) => collectRuntimeSourceFiles(join(path, entry)))
    .sort()
}

const runtimeSourceFiles = sourceRoots.flatMap((path) =>
  collectRuntimeSourceFiles(join(root, path))
)

const readProjectFile = (path: string) => readFileSync(join(root, path), 'utf8')
const sentryNextPackageName = ['@sentry', 'nextjs'].join('/')

describe('legacy cleanup boundary', () => {
  it('removes legacy runtime files and watermark assets', () => {
    for (const path of deletedPaths) {
      expect(existsSync(join(root, path)), path).toBe(false)
    }
  })

  it('keeps active runtime source free of legacy imports and Sentry', () => {
    for (const path of runtimeSourceFiles) {
      const source = readFileSync(path, 'utf8')
      const runtimePath = relative(root, path)

      expect(source, runtimePath).not.toContain('@/shared')
      expect(source, runtimePath).not.toContain('@/widgets')
      expect(source, runtimePath).not.toContain(sentryNextPackageName)
      expect(source, runtimePath).not.toMatch(/Sentry|sentry/)
      expect(source, runtimePath).not.toMatch(/watermark|Watermark/)
    }
  })

  it('keeps root config free of deleted legacy paths', () => {
    const vercelConfig = readProjectFile('vercel.json')
    const tailwindConfig = readProjectFile('tailwind.config.ts')

    expect(vercelConfig).not.toContain('app/api/parse-truck/route.ts')
    expect(vercelConfig).toContain('app/api/v2/parse-truck/route.ts')
    expect(tailwindConfig).not.toContain('src/widgets')
    expect(tailwindConfig).not.toContain('src/shared')
    expect(tailwindConfig).toContain('src/v2')
  })
})
