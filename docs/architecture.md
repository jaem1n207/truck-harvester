# Truck Harvester v2 Architecture

`/v2` is a parallel rebuild. It must not break the legacy `/` route and it
must not import legacy watermarking or Sentry code.

## Runtime Flow

```mermaid
flowchart LR
  A["Staff paste listing addresses"] --> B["URL input widget validates addresses"]
  B --> C["Batch processor schedules parse jobs"]
  C --> D["POST /api/v2/parse-truck once per address"]
  D --> E["Pure Cheerio parser returns truck listing data"]
  E --> F["Zustand batch state updates each item"]
  F --> G["Processing widgets stream status cards"]
  G --> H["File System Access API saves image folders"]
  G --> I["ZIP fallback downloads archive"]
  F --> J["Attention panel holds retry or skip work"]
```

The client owns scheduling with concurrency 5. The server endpoint accepts
one address at a time so each request can stay inside the short Vercel
Hobby execution budget.

## Sequence

```mermaid
sequenceDiagram
  participant User as Staff
  participant Page as /v2 page
  participant Batch as processTruckBatch
  participant API as /api/v2/parse-truck
  participant Store as batch store
  participant Save as file management

  User->>Page: Paste addresses and start
  Page->>Batch: Start jobs with concurrency 5
  loop Each listing address
    Batch->>Store: setParsing
    Batch->>API: POST one address
    API-->>Batch: parsed listing or typed failure
    Batch->>Store: setParsed or setFailed
  end
  Page->>Save: Save each parsed listing
  Save-->>Store: setDownloaded or setFailed
  Store-->>Page: render done, in-progress, and attention groups
```

## Layer Responsibilities

- `src/app/v2`: route composition, page layout, and wiring.
- `src/v2/widgets`: user-facing blocks that compose features and shared
  selectors.
- `src/v2/features`: workflows such as parsing, saving, and onboarding.
- `src/v2/entities`: pure schemas and state contracts.
- `src/v2/shared`: utilities, stores, selectors, and low-level UI.
- `src/v2/design-system`: tokens and motion presets for `/v2`.

## Guardrails

- No Sentry in `/v2`.
- No watermark in `/v2`.
- User-facing copy is Korean-only.
- Default concurrency is 5.
- New deferred work should become a GitHub issue instead of staying as a
  loose TODO.
