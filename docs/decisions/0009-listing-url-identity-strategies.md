# ADR-0009: Truck Listing URL Identity Strategies

## Status

Accepted.

## Context

Truck Harvester accepts listing detail addresses only from
`www.truck-no1.co.kr/model/DetailView.asp`. The original URL contract required
the legacy query tuple `ShopNo`, `MemberNo`, and `OnCarNo`.

On 2026-08-25 the live source exposed detail links with one encrypted identifier
instead:

```text
https://www.truck-no1.co.kr/model/DetailView.asp?encOnCarNo=<opaque-token>
```

The upstream page returned `200 OK`, but both the paste workflow and
`POST /api/v2/parse-truck` rejected the address before any source request. The
API returned `400 invalid-address` because the shared Zod contract still
required the three legacy keys.

Bypassing only that validation and running the existing fetch and Cheerio parser
against the same page returned the expected listing, 20 images, and a
performance-check link. The failure was therefore URL-contract drift, not a
transport, TLS, timeout, or HTML-selector failure.

## Decision

Keep one listing URL contract in `src/v2/entities/url/model.ts`. The paste
workflow and parse API continue reusing that contract rather than maintaining
their own query-key rules.

The contract keeps the existing hostname and pathname allowlists and accepts
either identity strategy:

1. legacy identity: one non-empty `ShopNo`, `MemberNo`, and `OnCarNo`;
2. encrypted identity: one non-empty `encOnCarNo`.

Recognized identity keys must not be duplicated. A request with repeated
`ShopNo`, `MemberNo`, `OnCarNo`, or `encOnCarNo` fails closed instead of relying
on parameter order or the upstream server's duplicate-key behavior.

`encOnCarNo` is an opaque token:

- do not infer meaning from its value;
- do not constrain it to the currently observed length or character set;
- preserve its characters exactly during paste extraction;
- do not translate it into the legacy tuple.

Legacy URLs keep the existing trailing chat-punctuation cleanup. Opaque
encrypted identities skip that cleanup because a trailing punctuation
character may be part of the token. Users are instructed to paste the complete
address copied from the browser.

The app remains specific to `truck-no1.co.kr`. This decision does not add a
multi-site provider registry or change listing fetch and HTML parsing.

## Why This Option

- It restores current source compatibility without removing the hostname or
  pathname trust boundary.
- It keeps previously copied and bookmarked legacy addresses working.
- Treating the encrypted value as opaque avoids another outage if only its
  encoding, length, or alphabet changes.
- One entity contract prevents the client extractor and server route from
  drifting.
- Duplicate-key rejection produces deterministic behavior independent of query
  ordering.
- A named identity predicate is cheaper to maintain than a general provider
  abstraction while only one listing source is supported.

## Rejected Alternatives

### Add `encOnCarNo` to the legacy required-key list

This would require all four keys and continue rejecting the new address.
Identity formats are alternatives, not cumulative requirements.

### Accept any query on the allowlisted path

This would send malformed or non-listing detail requests upstream and weaken
the fail-closed contract. At least one known identity strategy must match.

### Require the observed encrypted token shape

The sampled links used uppercase hexadecimal-looking values, but the
application has no provider contract proving that shape is stable. A fixed
length or regular expression would turn an upstream encoding change into the
same outage.

### Convert encrypted links to legacy identifiers

The app does not know the source's private mapping. Resolving or reverse
engineering it adds another upstream dependency and is unnecessary because the
existing fetch and parser accept the encrypted address directly.

### Change only the paste regular expression or API route

Either change would duplicate domain rules and leave the other boundary
rejecting the same address. Both consumers must reuse the entity contract.

### Strip trailing punctuation from encrypted identities

Plain pasted text cannot reliably distinguish chat punctuation from a valid
opaque-token character. Silent removal can change the requested listing.
Preserving the token is safer than rewriting it.

### Add a generic listing-site provider layer

No second listing source is planned. A provider registry would add interfaces
and indirection without solving a current requirement.

## Consequences

- Both legacy and encrypted listing addresses reach the existing fetch and
  parser paths.
- Empty, partial, or duplicated known identities return the existing
  non-technical invalid-address guidance.
- Extra unrelated query parameters remain allowed, matching the previous
  contract.
- An opaque address copied with external chat punctuation attached may reach
  the upstream unchanged and fail there. Avoiding silent token mutation is the
  deliberate trade-off.
- A future identity-key change requires one new named predicate and focused
  entity, paste-parser, and API-route coverage. It does not automatically
  justify fetch, TLS, parser, or multi-provider changes.

## Investigation And Validation Record

The repair followed this sequence:

1. Reproduced the visible invalid-address message with the supplied encrypted
   link.
2. Confirmed the upstream listing returned `200 OK`.
3. Confirmed the deployed parse API rejected the same link with
   `400 invalid-address`.
4. Ran the existing fetch and parser without the stale URL contract and
   recovered the listing, 20 images, and performance-check link.
5. Added failing entity, paste-parser, and route regression tests before
   changing production code.
6. Updated the shared contract and observed those tests pass.
7. An independent diff review found two opaque-token boundary issues:
   trailing punctuation mutation and duplicate-key order dependence.
8. Reproduced both issues, added failing tests, fixed them, and repeated the
   review.
9. The final review reported no Critical, Important, or Minor findings.

Pre-PR verification included:

- five focused Vitest files with 34 passing tests;
- TypeScript typecheck;
- ESLint;
- Prettier;
- a live local-route smoke test returning `200`, 20 images, and a
  performance-check link for the reported listing.

## Maintenance Criteria

Use `docs/runbooks/debug-failed-scrape.md` when invalid-address failures
increase.

If the source changes listing links:

1. verify the exact hostname and pathname before changing the allowlist;
2. confirm the live page independently from the application;
3. separate URL-contract, transport, TLS, and parser failures;
4. treat new identifier values as opaque unless the provider publishes a stable
   value contract;
5. add failing entity, paste-parser, and API-route tests before implementation;
6. update this ADR, `docs/architecture.md`, and the scrape runbook together.

Do not broaden the hostname/path boundary, change fetch behavior, or introduce a
provider layer without separate evidence and review.
