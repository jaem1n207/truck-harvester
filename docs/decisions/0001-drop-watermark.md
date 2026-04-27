# ADR-0001: Drop Image Stamping From v2

## Status

Accepted.

## Context

The legacy app could stamp images before saving. The rebuilt app preserves
the useful download flow while removing that extra image-processing step.

## Decision

The root app does not import or implement image stamping. It saves fetched
image blobs directly.

## Consequences

- The root app saves fetched image blobs directly.
- Client CPU work is lower because canvas image processing is gone.
- The old image-stamping runtime and assets were removed during cutover.
