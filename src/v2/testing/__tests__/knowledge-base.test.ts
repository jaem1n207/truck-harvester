import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readText = (path: string) => readFileSync(path, 'utf8')

const requiredDocs = [
  'docs/architecture.md',
  'docs/runbooks/add-widget.md',
  'docs/runbooks/add-design-token.md',
  'docs/runbooks/debug-failed-scrape.md',
  'docs/runbooks/add-e2e-test.md',
  'docs/decisions/0001-drop-watermark.md',
  'docs/decisions/0002-client-parallel-vs-server-parallel.md',
  'docs/decisions/0003-design-token-strategy.md',
  'docs/decisions/0004-concurrency-limiter-choice.md',
  'docs/decisions/0005-onboarding-tour-strategy.md',
]

const layerAgentFiles = [
  'AGENTS.md',
  'src/v2/AGENTS.md',
  'src/v2/entities/AGENTS.md',
  'src/v2/features/AGENTS.md',
  'src/v2/shared/AGENTS.md',
  'src/v2/widgets/AGENTS.md',
]

describe('v2 AI knowledge base', () => {
  it('contains the required architecture, runbook, and ADR files', () => {
    expect(requiredDocs.filter((path) => !existsSync(path))).toEqual([])
  })

  it('keeps the root agent guide useful for a five-minute orientation', () => {
    const guide = readText('AGENTS.md')

    expect(guide).toContain('## Mission')
    expect(guide).toContain('## Stack')
    expect(guide).toContain('## Run And Test Commands')
    expect(guide).toContain('## Where To Look')
    expect(guide).toContain('## First 5 Files For Any Task')
    expect(guide).toContain('docs/architecture.md')
    expect(guide).toContain('docs/decisions/')
  })

  it('cross-links per-layer agent guides to runbooks and decisions', () => {
    const missingLinks = layerAgentFiles.filter((path) => {
      const guide = readText(path)

      return (
        !guide.includes('docs/runbooks/') || !guide.includes('docs/decisions/')
      )
    })

    expect(missingLinks).toEqual([])
  })

  it('documents the v2 data flow with a Mermaid diagram', () => {
    const architecture = readText('docs/architecture.md')

    expect(architecture).toContain('```mermaid')
    expect(architecture).toContain('/api/v2/parse-truck')
    expect(architecture).toContain('concurrency 5')
  })

  it('documents the onboarding tour example cards and keyboard movement', () => {
    const decision = readText('docs/decisions/0005-onboarding-tour-strategy.md')

    expect(decision).toContain('compact example cards')
    expect(decision).toContain('ArrowLeft')
    expect(decision).toContain('ArrowRight')
    expect(decision).toContain('editable controls')
  })
})
