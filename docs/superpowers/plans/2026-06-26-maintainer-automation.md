# Maintainer Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PR label automation and conservative issue stale marking for `truck-harvester` while preserving the existing Bun/Playwright CI workflow.

**Architecture:** Add one label-only `pull_request_target` workflow, one `.github/labeler.yml`, and one scheduled stale workflow. The plan does not modify the existing `ci.yml`, does not add Release Drafter, and does not add PR comments until a concrete repeated checklist proves useful.

**Tech Stack:** GitHub Actions, actions/labeler pinned to `v6.1.0`, actions/stale pinned to `v10.3.0`, existing Bun/Next.js/Playwright CI.

---

## File Structure

Create or modify these files inside `/Users/jaemin/programming/projects/archive/truck-harvester`.

- Create: `.github/workflows/labeler.yml`
  - Responsibility: Apply PR labels without checking out or executing PR code.
- Create: `.github/labeler.yml`
  - Responsibility: Define file and branch matching rules for API, parser, renderer, analytics, docs, test, and CI labels.
- Create: `.github/workflows/stale.yml`
  - Responsibility: Mark inactive issues stale without closing issues or PRs automatically.
- Preserve: `.github/workflows/ci.yml`
  - Responsibility: Continue running the existing Bun install, typecheck, lint, format, tests, Carmodoo smoke, and build flow.

## Task 1: Add PR Labeler

**Files:**

- Create: `/Users/jaemin/programming/projects/archive/truck-harvester/.github/workflows/labeler.yml`
- Create: `/Users/jaemin/programming/projects/archive/truck-harvester/.github/labeler.yml`

- [ ] **Step 1: Add the labeler workflow**

Create `/Users/jaemin/programming/projects/archive/truck-harvester/.github/workflows/labeler.yml`:

```yaml
name: Label PRs

on:
  pull_request_target:
    types:
      - opened
      - synchronize
      - reopened
      - ready_for_review

permissions:
  contents: read
  pull-requests: write

jobs:
  label:
    name: Label
    runs-on: ubuntu-latest
    steps:
      - name: Apply labels
        uses: actions/labeler@f27b608878404679385c85cfa523b85ccb86e213 # v6.1.0
        with:
          sync-labels: true
```

Expected: The workflow never checks out the repository and only changes PR labels.

- [ ] **Step 2: Add the labeler config**

Create `/Users/jaemin/programming/projects/archive/truck-harvester/.github/labeler.yml`:

```yaml
'area:ci':
  - changed-files:
      - any-glob-to-any-file:
          - '.github/**'

'area:docs':
  - changed-files:
      - any-glob-to-any-file:
          - 'docs/**'
          - 'memo/**'
          - 'README.md'
          - 'CLAUDE.md'
          - 'AGENTS.md'

'area:api':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/app/api/**'

'area:v2-workflow':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/v2/application/**'

'area:parsing':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/v2/shared/lib/**'
          - 'src/v2/features/truck-processing/**'
          - 'src/v2/features/listing-preparation/**'
          - 'src/v2/entities/**'

'area:rendering':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/**/carmodoo*'
          - 'src/**/checkpaper*'
          - 'src/**/renderer*'
          - 'e2e/carmodoo-*.spec.ts'
          - 'e2e/*render*.spec.ts'

'area:analytics':
  - changed-files:
      - any-glob-to-any-file:
          - 'src/**/analytics*'
          - 'src/v2/application/**/workflow-analytics*'

'area:e2e':
  - changed-files:
      - any-glob-to-any-file:
          - 'e2e/**'

'area:tests':
  - changed-files:
      - any-glob-to-any-file:
          - '**/*.test.ts'
          - '**/*.test.tsx'
          - '**/__tests__/**'

'area:package':
  - changed-files:
      - any-glob-to-any-file:
          - 'package.json'
          - 'bun.lock'
          - 'next.config.*'
          - 'tsconfig.json'

'type:feature':
  - head-branch:
      - '^feat[/-]'
      - '^feature[/-]'

'type:fix':
  - head-branch:
      - '^fix[/-]'
      - '^hotfix[/-]'

'type:docs':
  - head-branch:
      - '^docs[/-]'

'status:needs-review':
  - base-branch:
      - '^main$'
```

Expected: The config labels API, parser, renderer, analytics, e2e, docs, package, test, and CI work without catch-all labels.

- [ ] **Step 3: Validate labeler files**

Run:

```bash
actionlint .github/workflows/labeler.yml
ruby -e 'require "yaml"; YAML.load_file(".github/labeler.yml"); puts "labeler config ok"'
```

Expected: `actionlint` prints no output, and Ruby prints `labeler config ok`.

- [ ] **Step 4: Confirm existing CI workflow is unchanged**

Run:

```bash
git diff -- .github/workflows/ci.yml
```

Expected: No output.

- [ ] **Step 5: Commit labeler automation**

Run:

```bash
git add .github/workflows/labeler.yml .github/labeler.yml docs/superpowers/plans/2026-06-26-maintainer-automation.md
git commit -m "ci: add pull request labeler"
```

Expected: One commit contains labeler files and this plan file; existing CI remains unchanged.

## Task 2: Add Conservative Issue Stale Marking

**Files:**

- Create: `/Users/jaemin/programming/projects/archive/truck-harvester/.github/workflows/stale.yml`

- [ ] **Step 1: Add the stale workflow**

Create `/Users/jaemin/programming/projects/archive/truck-harvester/.github/workflows/stale.yml`:

```yaml
name: Mark Stale Issues

on:
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:

permissions:
  issues: write
  pull-requests: write

jobs:
  stale:
    name: Mark stale issues
    runs-on: ubuntu-latest
    steps:
      - name: Mark inactive issues
        uses: actions/stale@eb5cf3af3ac0a1aa4c9c45633dd1ae542a27a899 # v10.3.0
        with:
          stale-issue-label: 'status:stale'
          stale-pr-label: 'status:stale'
          days-before-issue-stale: 90
          days-before-issue-close: -1
          days-before-pr-stale: -1
          days-before-pr-close: -1
          stale-issue-message: >-
            이 이슈는 90일 동안 활동이 없어 stale로 표시합니다.
            아직 필요하면 댓글을 남기거나 `status:stale` 라벨을 제거해 주세요.
          exempt-issue-labels: >-
            security,pinned,in-progress,needs-decision,customer-critical,preview-investigation,deployment-investigation
          exempt-pr-labels: >-
            security,pinned,in-progress,needs-decision,customer-critical,preview-investigation,deployment-investigation
          operations-per-run: 50
```

Expected: The workflow marks inactive issues stale after 90 days, never closes issues, and never marks or closes PRs automatically.

- [ ] **Step 2: Validate stale workflow syntax**

Run:

```bash
actionlint .github/workflows/stale.yml
```

Expected: No output and exit code `0`.

- [ ] **Step 3: Review stale workflow permissions**

Run:

```bash
sed -n '1,120p' .github/workflows/stale.yml
```

Expected: The file shows only `issues: write` and `pull-requests: write`; it does not include `contents: write` or secrets.

- [ ] **Step 4: Commit stale automation**

Run:

```bash
git add .github/workflows/stale.yml
git commit -m "ci: add stale issue marking"
```

Expected: One commit contains only the stale workflow.

## Self-Review Checklist

- [ ] Existing `.github/workflows/ci.yml` remains unchanged.
- [ ] Labeler uses `pull_request_target` without checkout or code execution.
- [ ] Stale marks issues only and never auto-closes issues or PRs.
- [ ] Release Drafter and PR comment automation are not included in this first implementation.
- [ ] All third-party actions are pinned to full commit SHA.
