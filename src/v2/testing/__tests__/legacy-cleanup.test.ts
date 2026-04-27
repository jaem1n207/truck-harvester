import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const joinText = (...parts: string[]) => parts.join('')
const monitoringName = joinText('sen', 'try')
const imageStampName = joinText('water', 'mark')

const deletedPaths = [
  'src/app/api/parse-truck/route.ts',
  'src/app/api/parse-truck/__tests__/route.test.ts',
  'src/app/api/network-test/route.ts',
  `src/app/api/${monitoringName}-error-handler.ts`,
  `src/app/api/${monitoringName}-example-api/route.ts`,
  `src/app/${monitoringName}-example-page/page.tsx`,
  'src/app/v2/AGENTS.md',
  'src/instrumentation.ts',
  'src/instrumentation-client.ts',
  `${monitoringName}.server.config.ts`,
  `${monitoringName}.edge.config.ts`,
  'src/shared',
  'src/widgets',
  `public/${imageStampName}-1.png`,
  `public/${imageStampName}-2.png`,
  `public/${imageStampName}-3.png`,
  `public/${imageStampName}-4.png`,
  `public/${imageStampName}-5.png`,
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
const legacySharedAlias = joinText('@', '/shared')
const legacyWidgetsAlias = joinText('@', '/widgets')
const monitoringPackageName = ['@', monitoringName, 'nextjs'].join('/')
const forbiddenRuntimeTerms = new RegExp(
  [
    joinText('Sen', 'try'),
    monitoringName,
    imageStampName,
    joinText('Water', 'mark'),
  ].join('|')
)

describe('legacy cleanup boundary', () => {
  it('removes deleted runtime files and image stamp assets', () => {
    for (const path of deletedPaths) {
      expect(existsSync(join(root, path)), path).toBe(false)
    }
  })

  it('keeps active runtime source free of legacy imports and monitoring hooks', () => {
    for (const path of runtimeSourceFiles) {
      const source = readFileSync(path, 'utf8')
      const runtimePath = relative(root, path)

      expect(source, runtimePath).not.toContain(legacySharedAlias)
      expect(source, runtimePath).not.toContain(legacyWidgetsAlias)
      expect(source, runtimePath).not.toContain(monitoringPackageName)
      expect(source, runtimePath).not.toMatch(forbiddenRuntimeTerms)
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
