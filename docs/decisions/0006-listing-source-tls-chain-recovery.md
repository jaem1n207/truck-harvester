# ADR-0006: Listing Source TLS Chain Recovery

## Status

Accepted.

## Context

The active parse route fetches one allowlisted `truck-no1.co.kr` listing per
request inside a 3.5-second budget. On 2026-07-30 the source returned its valid
leaf certificate without the Sectigo Public Server Authentication CA DV R36
intermediate. Browsers and `curl` could still succeed through certificate
caches or AIA chasing, while Vercel's Node `fetch` failed immediately with:

```text
TypeError: fetch failed
cause.code: UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

The route mapped every non-abort exception to the generic `unknown` 502
response, so this transport failure appeared to users and maintainers as a
parser failure. The HTML selectors and target listing data were still valid.

The missing intermediate is a public CA certificate. It contains a public key,
subject, issuer, validity, extensions, and CA signature; it does not contain a
private key or credential.

## Decision

Keep the ordinary Node `fetch` as the primary path. When and only when its error
cause chain contains one of the known missing-issuer codes, retry once through
Node HTTPS with:

- the exact hostname `www.truck-no1.co.kr`;
- the same `AbortController` and original request timeout budget;
- Node's complete `rootCertificates` list;
- the reviewed Sectigo Public Server Authentication CA DV R36 intermediate;
- `rejectUnauthorized: true`;
- `Accept-Encoding: identity`.

The embedded intermediate is version-controlled next to its subject,
SHA-256 fingerprint, and expiration date. Node documents that supplying `ca`
replaces the default CA list, so the implementation explicitly concatenates
the default roots instead of silently narrowing global trust:
<https://nodejs.org/api/tls.html>.

The Sectigo CA hierarchy and public issuing certificate are documented by the
issuer:
<https://www.sectigo.com/knowledge-base/detail/Sectigo-Public-Intermediates-and-Roots>.

## Current Reviewed Intermediate

Verified on 2026-07-30:

- Subject: `C=GB, O=Sectigo Limited, CN=Sectigo Public Server Authentication CA DV R36`
- Issuer: `C=GB, O=Sectigo Limited, CN=Sectigo Public Server Authentication Root R46`
- Validity: 2021-03-22 through 2036-03-21
- SHA-256 fingerprint:
  `8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0`
- Key usage: certificate signing and CRL signing
- Extended purpose: TLS server/client CA

These values identify public trust material. A replacement is not approved
merely because it has the same display name; maintainers must compare the full
fingerprint, issuer, validity, CA constraints, and signature chain.

## Why This Option

This is the narrowest deterministic repair that preserves TLS authentication
and the existing deployment budget:

- Standard fetch automatically becomes sufficient again when the source fixes
  its served chain.
- The fallback is local to one route helper and one hostname; it does not
  change process-wide TLS behavior.
- The public certificate and fingerprint are reviewable in source control.
- The second attempt reuses the original timeout instead of introducing an
  unbounded recovery request.
- Other TLS failures still fail closed.

## Rejected Alternatives

### Disable certificate verification

`NODE_TLS_REJECT_UNAUTHORIZED=0` and `rejectUnauthorized: false` would accept
forged, expired, or hostname-invalid certificates. This converts an upstream
configuration defect into a man-in-the-middle vulnerability and is prohibited.

### Downgrade the listing request to HTTP

The listing is public, but its HTML controls returned image URLs, vehicle
metadata, and performance-check links. An HTTP downgrade would let a network
attacker modify that data before parsing.

### Set `NODE_EXTRA_CA_CERTS` or another process-wide CA override

The certificate is needed only for one external hostname. A deployment-level
override is harder to review, affects unrelated outbound TLS clients, and can
drift between local, preview, and production environments.

### Fetch the AIA intermediate dynamically on every failure

Runtime AIA fetching adds another external dependency and network round trip
inside the 3.5-second budget. It also complicates caching, timeout ownership,
and failure diagnosis. A reviewed, versioned public intermediate is more
deterministic.

### Add an external scraping proxy or worker

The source returns valid HTML within the current budget. Adding a proxy, queue,
or paid worker would expand infrastructure and data-flow scope without fixing
the underlying trust-chain diagnosis.

## Consequences

- The parse route can recover from the source's known incomplete chain while
  retaining certificate and hostname verification.
- The fallback trusts the reviewed intermediate as CA material for this exact
  destination. It is not leaf-certificate pinning.
- The embedded certificate is safe in a public repository and does not belong
  in a secret or environment variable.
- The intermediate expires on 2036-03-21, but the source may rotate issuers
  earlier. Maintainers must verify subject, issuer, validity, and SHA-256
  fingerprint before replacement.
- The fallback request does not follow redirects. Redirect support requires a
  separate allowlist and SSRF review.
- Node HTTPS abort errors must continue mapping to `504 site-timeout`; unrelated
  TLS, HTTP, and network errors remain `502 unknown`.

## Maintenance And Removal Criteria

Use `docs/runbooks/debug-failed-scrape.md` for commands and the complete
decision tree.

Update the embedded intermediate only when:

1. the source leaf issuer changed or the current intermediate expired;
2. the replacement came from the leaf AIA URL or Sectigo's official
   repository;
3. subject, issuer, dates, and SHA-256 fingerprint were independently checked;
4. a Node request succeeds with default roots plus the candidate while
   `rejectUnauthorized: true`;
5. focused regression tests, the actual listing URL, and the full quality
   gates pass.

Remove the fallback only after the source consistently serves a complete chain,
plain Node `fetch` succeeds in both local Node and a Vercel preview, and the
missing-chain regression is replaced with coverage for the new normal path.
