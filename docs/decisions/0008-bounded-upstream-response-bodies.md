# ADR-0008: Bounded Upstream Response Bodies

## Status

Accepted.

## Context

The listing parser and performance-check proxy accept responses from a small,
allowlisted set of public upstream hosts. ADR-0006 and ADR-0007 added
exact-host TLS chain recovery for two hosts that omit public intermediate
certificates.

The original compatibility transports accumulated the complete Node HTTPS
response before returning it to the caller:

- listing HTML was appended to an unbounded string;
- Autocafe response chunks were retained and combined with `Buffer.concat`.

The regular Fetch paths also used `response.text()` or
`response.arrayBuffer()` without an application-owned byte limit. Transport
timeouts bounded duration, but they did not bound memory. A compromised or
misconfigured allowlisted upstream could therefore keep sending a large body
within the timeout and consume excessive function memory before the parser,
redirect policy, or content-type checks ran.

## Decision

Apply one shared bounded response reader to both the standard Fetch and
trusted-chain fallback paths:

| Response class                          | Maximum decoded bytes |
| --------------------------------------- | --------------------- |
| Truck listing HTML                      | 2 MiB                 |
| Performance-check HTML and CSS          | 4 MiB                 |
| Performance-check PDF, image, or binary | 16 MiB                |

The reader enforces these rules:

1. A valid declared `Content-Length` above the limit is rejected before body
   consumption.
2. The cumulative streamed byte count is authoritative. Missing, invalid, or
   dishonest `Content-Length` values cannot bypass the limit.
3. A body exactly at the limit is accepted; the first byte over the limit
   rejects the response.
4. Timeout and overflow both cancel the Web stream.
5. The Node HTTPS adapter exposes headers immediately and transfers body chunks
   with backpressure. Cancellation destroys the native source instead of
   retaining the rest of the response.
6. Redirect, status, allowlist, and MIME decisions happen before a complete
   fallback body is buffered.

The limits are deliberately separated by use case. Listing and
performance-check HTML are parser inputs, not file storage channels, so they
receive smaller limits. The binary proxy must accommodate normal PDF and image
records, but it still has a finite 16 MiB ceiling. The existing 3.5-second
listing budget and 4.5-second CheckPaper budget remain unchanged.

Limit failures keep the existing non-technical route responses. The listing
route maps them through its current generic failure contract. CheckPaper HTML
and asset routes return the existing 502 messages, and performance-check
saving remains non-fatal for the vehicle folder.

## Why This Option

- A shared reader prevents the normal and TLS recovery transports from drifting
  into different security policies.
- Stream counting covers chunked responses and transparent decompression, while
  `Content-Length` still provides an efficient early rejection.
- Header-first adaptation lets the redirect and MIME policies run without
  first buffering an attacker-controlled body.
- Cancellation stops upstream work promptly and prevents a rejected response
  from continuing to consume memory or bandwidth.
- The change preserves successful response bytes and does not alter parsing,
  rendering, folder layout, or user-facing copy.

## Rejected Alternatives

### Rely on request timeouts

A fast sender can transmit a very large response before a short timeout. Time
and memory are independent resource limits.

### Trust only `Content-Length`

The header is optional and controlled by the upstream. Chunked responses,
incorrect lengths, and decoded bodies require an observed-byte counter.

### Limit only the TLS fallback

The same allowlisted upstream data reaches the application through regular
Fetch when the server later fixes its certificate chain. Applying a weaker
policy to that primary path would recreate the vulnerability.

### Buffer first, validate later

Checking `byteLength` after `text()`, `arrayBuffer()`, or `Buffer.concat` does
not prevent the memory allocation being controlled.

## Consequences

- Responses above the selected ceiling fail closed even if the upstream is
  otherwise trusted and timely.
- Maintainers must distinguish an upstream payload growth incident from TLS,
  redirect, parser, or renderer failures.
- Raising a ceiling requires representative payload evidence, a memory-risk
  review, boundary tests, and updates to this ADR and the scrape runbook.
- New upstream body consumers must use the shared bounded reader or document a
  stricter streaming policy.

## Verification

Regression coverage must include:

- declared lengths above the limit;
- chunked bodies with no length that cross the limit;
- exact-limit success;
- reader cancellation on overflow and timeout;
- standard Fetch and trusted-chain parity;
- header-first Node stream adaptation;
- route-level mapping for oversized HTML and binary responses.

Run the focused suites listed in
`docs/runbooks/debug-failed-scrape.md`, followed by the full typecheck, lint,
format, unit, coverage, and build gates.
