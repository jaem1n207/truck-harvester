# ADR-0001: Drop Watermark From v2

## Status

Accepted.

## Context

The legacy app can stamp images with a watermark. The `/v2` rebuild must
preserve every existing capability except watermarking, and it must keep
legacy behavior untouched until cutover.

## Decision

`/v2` does not import or implement watermarking. Legacy watermark files and
call sites remain until the separate cutover PR.

## Consequences

- `/v2` saves fetched image blobs directly.
- Client CPU work is lower because canvas watermarking is gone.
- Legacy watermark code stays in the repository until `/v2` passes the
  cutover checklist.
