# Dependency Audit

Last verified: 2026-04-28

## Current Status

`bun audit` reports no known vulnerabilities for the rebuilt root app dependency
graph.

## Resolution Notes

- Removed unused direct development dependencies and configuration that were
  carried over from earlier scaffolding: shadcn CLI, MSW, Vitest UI,
  Commitizen, JSZip/Cheerio ambient types, shadcn CLI config files, the npm
  health-check script, and the related `test:ui` / Commitizen package
  configuration.
- Replaced the shadcn preset runtime package import with a local CSS snapshot at
  `src/app/shadcn-tailwind.css`, guarded by
  `src/v2/testing/__tests__/theme-source.test.ts`.
- Updated active development tools where their latest compatible releases stayed
  inside the current Next.js, ESLint, and Vitest stack.
- Kept ESLint on the latest compatible 9.x release because ESLint 10 currently
  breaks the Next lint integration used by this project.

## Audit Controls

Some vulnerable transitive packages are also used by older tool paths that still
require their original major versions. To avoid forcing incompatible majors into
those paths, the lockfile uses top-level development dependencies for compatible
resolution hints and narrow overrides only where they do not break tooling:

- `ajv@^8.20.0`: satisfies current Commitlint paths while leaving ESLint's
  required AJV 6 path intact.
- `brace-expansion@^1.1.13`, `minimatch@^3.1.5`, and `picomatch@^2.3.2`:
  satisfy compatible test and lint tool paths without overriding packages that
  already require newer majors.
- `flatted@^3.4.2`: overrides stale cache serialization paths.
- `postcss@^8.5.12`: overrides compatible PostCSS consumers across Next,
  Tailwind, and Vite tooling.

## Guardrails

- Do not reintroduce `shadcn` as a runtime dependency for Tailwind preset CSS.
- Do not add an external error-monitoring SDK or image-stamping pipeline.
- Re-run `bun audit` after dependency changes and update this document when the
  mitigation strategy changes.
