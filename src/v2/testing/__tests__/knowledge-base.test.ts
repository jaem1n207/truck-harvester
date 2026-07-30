import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readText = (path: string) => readFileSync(path, 'utf8')
const imageStampName = ['water', 'mark'].join('')

const requiredDocs = [
  'docs/architecture.md',
  'docs/runbooks/add-widget.md',
  'docs/runbooks/add-design-token.md',
  'docs/runbooks/debug-failed-scrape.md',
  'docs/runbooks/add-e2e-test.md',
  `docs/decisions/0001-drop-${imageStampName}.md`,
  'docs/decisions/0002-client-parallel-vs-server-parallel.md',
  'docs/decisions/0003-design-token-strategy.md',
  'docs/decisions/0004-concurrency-limiter-choice.md',
  'docs/decisions/0005-onboarding-tour-strategy.md',
  'docs/decisions/0006-listing-source-tls-chain-recovery.md',
]

const layerAgentFiles = [
  'AGENTS.md',
  'src/v2/AGENTS.md',
  'src/v2/application/AGENTS.md',
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

  it('documents the application workflow layer', () => {
    const guide = readText('src/v2/AGENTS.md')
    const applicationGuide = readText('src/v2/application/AGENTS.md')

    expect(guide).toContain('application/')
    expect(applicationGuide).toContain('business workflow orchestration')
    expect(applicationGuide).toContain('must not import widgets')
    expect(applicationGuide).toContain('workflow analytics')
  })

  it('documents the v2 data flow with a Mermaid diagram', () => {
    const architecture = readText('docs/architecture.md')

    expect(architecture).toContain('```mermaid')
    expect(architecture).toContain('The rebuilt app is served from `/`')
    expect(architecture).toContain('/api/v2/parse-truck')
    expect(architecture).toContain('concurrency 5')
    expect(architecture).not.toContain('parallel rebuild')
    expect(architecture).not.toContain('must not break the legacy `/` route')
  })

  it('documents the onboarding tour example cards and keyboard movement', () => {
    const decision = readText('docs/decisions/0005-onboarding-tour-strategy.md')

    expect(decision).toContain('compact example cards')
    expect(decision).toContain('ArrowLeft')
    expect(decision).toContain('ArrowRight')
    expect(decision).toContain('editable controls')
  })

  it('documents the listing source TLS recovery boundary and operations', () => {
    const architecture = readText('docs/architecture.md')
    const runbook = readText('docs/runbooks/debug-failed-scrape.md')
    const decision = readText(
      'docs/decisions/0006-listing-source-tls-chain-recovery.md'
    )
    const guide = readText('AGENTS.md')

    expect(architecture).toContain('Listing Source Fetch Trust Boundary')
    expect(architecture).toContain('UNABLE_TO_VERIFY_LEAF_SIGNATURE')
    expect(runbook).toContain('openssl s_client')
    expect(runbook).toContain('NODE_TLS_REJECT_UNAUTHORIZED=0')
    expect(decision).toContain('Rejected Alternatives')
    expect(decision).toContain('NODE_EXTRA_CA_CERTS')
    expect(decision).toContain('public repository')
    expect(guide).toContain(
      'docs/decisions/0006-listing-source-tls-chain-recovery.md'
    )
  })

  it('keeps rebuild memos clearly separated from current runtime guidance', () => {
    const memoGuide = readText('memo/AGENTS.md')
    const currentContext = readText('memo/useful-repo-context.md')

    expect(memoGuide).toContain('approved historical phase plan')
    expect(memoGuide).toContain('The old `/v2` URL')
    expect(memoGuide).toContain('compatibility redirect')
    expect(memoGuide).not.toContain('We are mid-rebuild')
    expect(currentContext).toContain(
      'src/app/api/v2/parse-truck/fetch-listing-html.ts'
    )
    expect(currentContext).toContain(
      'docs/decisions/0006-listing-source-tls-chain-recovery.md'
    )
  })
})
