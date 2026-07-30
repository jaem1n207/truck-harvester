# ADR-0007: Autocafe CheckPaper TLS Chain Recovery

## Status

Accepted.

## Context

Truck listing pages expose performance-check links through
`http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=...`. The CheckPaper
proxy follows an allowlisted redirect chain from that intermediate URL to
either CheckPaper or Carmodoo before selecting the renderer.

On 2026-07-31 every tested performance-check request failed before the renderer
ran. Vehicle images and manuscripts still saved because performance-check
saving is intentionally non-fatal, but the completion result became
`performanceCheckStatus: missing` and the UI showed
`성능점검기록부 확인 필요`.

The live redirect chain for `OnCarNo=2026300140712` was:

```text
http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp
  -> https://autocafe.co.kr/ASSO/CarCheck_Form.asp
  -> https://checkpaper.jmenetworks.co.kr/Service/CheckPaper
```

The first HTTP response was a valid 302. The second request failed in Node
before an HTTP response existed:

```text
TypeError: fetch failed
cause.code: UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

`openssl s_client` confirmed that `autocafe.co.kr` served only its leaf
certificate. The leaf issuer was `GoGetSSL RSA DV CA`, but the server omitted
that public intermediate. The final `checkpaper.jmenetworks.co.kr` request
returned 200 in plain Node and was not the failing system.

This TLS failure classification is separate from an Autocafe page that loads
successfully and explicitly says `등록된 성능점검 내역이 없습니다`. That response is
an absent-record state, not a transport or renderer failure.

## Decision

Keep standard `fetch` as the primary transport for every allowlisted CheckPaper
URL and every redirect hop. If and only if all of these conditions are true,
retry the current hop through Node HTTPS:

1. the URL protocol is HTTPS;
2. the exact hostname is `autocafe.co.kr`;
3. the error cause chain contains a known missing-issuer code;
4. the shared CheckPaper timeout budget has not expired.

The retry uses:

- Node's complete `rootCertificates` list;
- the reviewed `GoGetSSL RSA DV CA` public intermediate;
- the same request headers and `AbortSignal`;
- `Accept-Encoding: identity`;
- `rejectUnauthorized: true`.

Redirect handling remains in the existing manual redirect loop. Every next
location is canonicalized and checked before another request is sent. The
outbound request URL is rebuilt from a server-owned literal origin selected by
exact protocol and hostname. User-controlled pathname segments, query names,
and query values are decoded once and passed through `encodeURIComponent`
before they reach `fetch`.

The request boundary also rejects:

- non-default ports;
- URL credentials;
- fragments;
- unsupported host-specific paths;
- CheckPaper or Carmodoo HTTP URLs;
- malformed or overlong URLs;
- redirect targets outside the same closed policy.

The known Autocafe HTTP address is accepted as input for compatibility but
upgraded to the literal `https://autocafe.co.kr` origin before the first
outbound request. Its path is limited to the two known resolver endpoints.
CheckPaper and Carmodoo use HTTPS-only host-specific path prefixes. Path
segments are decoded repeatedly to detect nested dot-segment or encoded
separator evasions before canonical encoding. The retry does not widen the
destination set or reset the 4.5-second total budget.

Node documents that an explicit `ca` option replaces the default CA list, so
the fallback concatenates the default roots and reviewed intermediate:
<https://nodejs.org/api/tls.html>.

Sectigo's certificate guidance recommends obtaining a missing intermediate
from the leaf certificate's Authority Information Access field:
<https://www.sectigo.com/knowledge-base/detail/Sectigo-Intermediate-Certificates>.

The standard Fetch and trusted-chain paths expose the same streamed `Response`
contract. HTML and CSS are limited to 4 MiB; proxied PDF, image, and other
binary files are limited to 16 MiB. Declared lengths provide early rejection,
while cumulative observed bytes remain authoritative. Redirect bodies are
canceled before the next hop. ADR-0008 records this shared resource policy.

## Current Reviewed Intermediate

Verified on 2026-07-31 from the leaf AIA URL
`http://crt.usertrust.com/GoGetSSLRSADVCA.crt`:

- Subject: `C=LV, L=Riga, O=GoGetSSL, CN=GoGetSSL RSA DV CA`
- Issuer:
  `C=US, ST=New Jersey, L=Jersey City, O=The USERTRUST Network, CN=USERTrust RSA Certification Authority`
- Validity: 2018-09-06 through 2028-09-05
- SHA-256 fingerprint:
  `43:CA:C3:1E:F8:E8:BA:1B:4B:16:B8:20:6E:4C:0A:26:C5:BA:DB:2F:C3:AA:09:E9:01:70:E4:1B:66:C2:FD:64`
- CA purpose: TLS server/client certificate issuer

The certificate is public trust material, not a credential. It contains no
private key and is safe to review in a public repository. A replacement is not
approved merely because it has the same display name; maintainers must compare
the full fingerprint, issuer, validity, CA constraints, and signature chain.

## Why This Option

This is the narrowest repair that restores performance-check saving without
weakening the existing trust boundary:

- standard fetch automatically becomes sufficient when Autocafe repairs its
  served chain;
- only one exact hostname and known missing-chain errors activate the retry;
- hostname, validity, issuer-chain, and root trust verification remain active;
- literal origins, default ports, host-specific paths, and encoded URL
  components prevent arbitrary proxy destinations and request-target escape;
- the legacy Autocafe HTTP input is upgraded before transport, removing the
  plaintext redirect hop;
- the original timeout and abort ownership remain unchanged;
- standard and trusted-chain responses use identical application byte limits;
- the public intermediate and fingerprint are version-controlled and
  reviewable.

## Rejected Alternatives

### Disable TLS verification

`NODE_TLS_REJECT_UNAUTHORIZED=0` or `rejectUnauthorized: false` would accept
forged, expired, or hostname-invalid certificates. This would turn an upstream
configuration error into a man-in-the-middle vulnerability.

### Change the Autocafe HTTPS redirect back to HTTP

The record URL determines which vehicle document is fetched and saved. An HTTP
downgrade would allow network modification of the redirect destination and
record identifier.

### Add the certificate process-wide

`NODE_EXTRA_CA_CERTS` or a deployment-wide CA override would affect unrelated
outbound requests and could drift between local, preview, and production
environments. The required compatibility behavior belongs to one exact host.

### Fetch the AIA certificate dynamically on every request

Runtime AIA fetching adds an external dependency and round trip inside a
4.5-second route budget. It also makes the accepted trust material depend on
mutable network state instead of reviewed source.

### Increase only the proxy timeout

The failure occurred in about 58ms during the TLS handshake. No timeout increase
can repair a missing issuer chain.

### Skip performance-check resolution and suppress the warning

That would hide the symptom while continuing to omit a required user file.
Transport and renderer failures must keep the confirmation-needed notice.
Only an upstream response that explicitly confirms no registered record may use
the quieter not-registered label.

## Consequences

- Autocafe-backed CheckPaper and Carmodoo records can resolve in Node/Vercel
  while TLS verification remains enabled.
- The same helper serves both the HTML and asset proxy routes, so redirect
  behavior remains consistent.
- Other TLS errors, other hosts, non-default ports, credentials, fragments,
  unsupported paths, and insecure provider protocols fail closed.
- The fallback trusts the reviewed public intermediate as CA material only for
  `autocafe.co.kr`; it is not leaf-certificate pinning.
- Header-first fallback streaming allows redirect and MIME policy to run before
  a full response is buffered. Rejected, redirected, oversized, or timed-out
  bodies are canceled.
- A successfully fetched Autocafe page that explicitly reports no registered
  record becomes `performanceCheckStatus: not_registered`, while TLS, redirect,
  and renderer failures remain confirmation-needed states.
- The intermediate expires on 2028-09-05, but Autocafe may rotate issuers
  earlier.

## Maintenance And Removal Criteria

Use `docs/runbooks/debug-failed-scrape.md` for the repeatable commands.

Replace the embedded intermediate only when:

1. the live Autocafe leaf issuer changes or the current intermediate expires;
2. the candidate comes from the leaf AIA URL or the issuer's official
   repository;
3. subject, issuer, dates, fingerprint, CA constraints, and signature chain are
   verified;
4. plain Node still fails with a missing-issuer code;
5. Node HTTPS succeeds with default roots plus the candidate and
   `rejectUnauthorized: true`;
6. focused tests, a live local proxy request, and all quality gates pass.

Any response-limit change must also follow ADR-0008 and preserve identical
limits for standard Fetch and the trusted-chain fallback.

Remove the fallback only after Autocafe consistently serves a complete chain,
plain Node `fetch` succeeds locally and in a Vercel preview, and the
missing-chain regression is replaced with coverage for the repaired upstream.
