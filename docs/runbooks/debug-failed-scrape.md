# Runbook: Debug a Failed Scrape

Use this when the root app cannot load a truck listing, returns incomplete
data, or fails to discover the listing's performance-check link. Diagnose the
request layer before changing Cheerio selectors.

## Ownership Map

- URL allowlist and required parameters:
  `src/v2/entities/url/model.ts`
- Source request, timeout, and TLS recovery:
  `src/app/api/v2/parse-truck/fetch-listing-html.ts`
- API validation and error mapping:
  `src/app/api/v2/parse-truck/route.ts`
- HTML selectors and listing semantics:
  `src/v2/shared/lib/parse-truck-html.ts`
- Performance-check proxy and renderer:
  `src/app/api/v2/checkpaper/` and
  `src/v2/features/file-management/performance-check-capture.ts`

## Failure Classification

| Observation                                                                   | Likely layer           | First action                                                         |
| ----------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| API returns `400 invalid-address`                                             | URL contract           | Check hostname, path, and `ShopNo`, `MemberNo`, `OnCarNo`            |
| API returns `504 site-timeout`                                                | Source request budget  | Compare upstream response time with the 3.5-second budget            |
| Browser or `curl` succeeds, plain Node fetch fails with a missing-issuer code | TLS chain              | Follow the TLS diagnosis below                                       |
| API returns `200` with fallback copy or empty images                          | HTML parser            | Save a sanitized HTML fixture and inspect selectors                  |
| API returns `502 unknown` for non-chain errors                                | HTTP, TLS, or network  | Preserve the original cause; do not broaden the certificate fallback |
| Listing parses but performance-check saving fails                             | CheckPaper integration | Inspect the CheckPaper routes before changing the listing parser     |

Known missing-issuer codes are:

- `UNABLE_TO_GET_ISSUER_CERT`
- `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

Expired certificates, hostname mismatches, unrelated TLS failures, non-2xx
responses, and parsing errors are not certificate-chain recovery cases.

## Reproduce One Listing

Use a real supported listing URL and keep the request to one listing:

```bash
curl 'http://localhost:3000/api/v2/parse-truck' \
  -H 'content-type: application/json' \
  --data-raw '{
    "url":"https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3",
    "timeoutMs":3500
  }'
```

Record the HTTP status, response body, elapsed time, runtime, and exact commit.
Do not infer the cause from the Korean recovery message alone; `502 unknown`
intentionally hides technical details from users.

## Separate Transport From Parsing

Check whether the source returns HTML without invoking the application:

```bash
listing_url='https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=1&MemberNo=2&OnCarNo=3'

curl -sS --compressed \
  -o /dev/null \
  -w 'status=%{http_code} total=%{time_total}s size=%{size_download}\n' \
  "$listing_url"
```

Then run the same request through Node, which matches the Vercel route runtime
more closely than a browser or system `curl`:

```bash
node -e '
const listingUrl = process.argv[1]
fetch(listingUrl)
  .then((response) => console.log({
    status: response.status,
    url: response.url,
  }))
  .catch((error) => console.error({
    name: error.name,
    message: error.message,
    cause: error.cause,
  }))
' "$listing_url"
```

If both receive HTML, continue with parser fixtures. If `curl` succeeds but
Node reports a missing-issuer code, inspect the served chain.

## Diagnose The Served TLS Chain

```bash
openssl s_client \
  -connect www.truck-no1.co.kr:443 \
  -servername www.truck-no1.co.kr \
  -showcerts \
  -verify_return_error \
  </dev/null
```

An incomplete-chain incident shows only the leaf certificate under
`Certificate chain` and an issuer verification error. Inspect the leaf:

```bash
openssl s_client \
  -connect www.truck-no1.co.kr:443 \
  -servername www.truck-no1.co.kr \
  -showcerts \
  </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -fingerprint -sha256 -text
```

Confirm all of the following before classifying the incident:

1. The leaf subject covers `www.truck-no1.co.kr`.
2. The issuer names the expected intermediate.
3. Node fails with a missing-issuer code, not expiration or hostname failure.
4. The ordinary upstream response is otherwise a timely 2xx HTML response.
5. The current embedded intermediate subject matches the leaf issuer.

The implementation first uses standard Node `fetch`. Only the known
missing-issuer errors activate the hostname-scoped HTTPS retry. The retry
combines Node's default root certificates with the reviewed intermediate and
keeps `rejectUnauthorized: true`.

## Why The Recovery Is Narrow

Do not use any of these workarounds:

- `NODE_TLS_REJECT_UNAUTHORIZED=0`
- `rejectUnauthorized: false`
- an `http://` listing request
- a process-global CA replacement
- a generic proxy that accepts arbitrary destinations

They either disable authentication, expose listing data to modification,
broaden trust for unrelated requests, or create an SSRF/infrastructure
boundary. ADR-0006 records the complete option analysis.

The embedded intermediate is a public CA certificate, not a secret. Keeping it
in source control makes its subject, fingerprint, expiration, and changes
reviewable. It must never be replaced with a private key, PKCS#12 file, or
unverified certificate copied from an arbitrary website.

## Replace An Intermediate Certificate

Replace the embedded certificate only when the source leaf issuer changes or
the current intermediate expires.

1. Obtain the candidate from the leaf's `Authority Information Access` URL or
   Sectigo's official public certificate repository.
2. Store it only in a temporary path while reviewing it.
3. Inspect the candidate:

   ```bash
   candidate_certificate='/private/tmp/truck-listing-intermediate.crt'

   openssl x509 \
     -inform DER \
     -in "$candidate_certificate" \
     -noout \
     -subject \
     -issuer \
     -dates \
     -fingerprint \
     -sha256 \
     -purpose
   ```

   If the download is already PEM, omit `-inform DER`.

4. Confirm the candidate is a CA certificate, its subject equals the leaf
   issuer, its signature chains to a Node-trusted root, and its validity covers
   the planned operating period.
5. Update the PEM, subject, SHA-256 fingerprint, and expiration comment
   together in `fetch-listing-html.ts`.
6. Keep `rootCertificates`, the exact hostname guard, the shared abort signal,
   and `rejectUnauthorized: true`.
7. Run the focused tests, call the actual listing through a local Node server,
   and verify a Vercel preview before merging.
8. Update ADR-0006 and this runbook if the trust path or recovery behavior
   changed.

The current Sectigo hierarchy is listed at:
<https://www.sectigo.com/knowledge-base/detail/Sectigo-Public-Intermediates-and-Roots>.

## Remove The Recovery

Do not remove the fallback after one successful browser request. Remove it only
when:

1. repeated `openssl s_client` checks show the source serving a complete chain;
2. plain Node `fetch` succeeds locally without the additional CA;
3. a Vercel preview succeeds for representative active listings;
4. the missing-chain regression is replaced with coverage for the new normal
   path;
5. ADR-0006, architecture, this runbook, README, and agent guidance are updated
   in the same change.

Because standard fetch is already the first attempt, an upstream repair takes
effect automatically while the compatibility fallback remains available.

## Parser Diagnosis

When transport succeeds but data is incomplete:

1. Save or sanitize a representative HTML fixture before changing selectors.
2. Update `src/v2/shared/lib/parse-truck-html.ts`.
3. Preserve these existing semantics:
   - `년형 | 등록` produces `smartStoreTable.registrationLabel` from the
     `최초등록` 8-digit date.
   - `상세설명` labels `차명:`, `상부:`, and `하부:` populate
     `smartStoreTable`.
   - Continuation paragraphs stay with `상부` or `하부` until the next known
     label or seller-intro separator.
   - `추가장착 옵션` is not the displayed `차량정보` fallback.
4. Keep user-facing failure copy Korean and non-technical.

If the source changed broadly, open a `jaem1n207`-assigned GitHub issue for
fixture expansion instead of weakening the parser with unbounded fallbacks.

## Performance-Check Diagnosis

If listing parsing succeeds but the performance record fails, inspect
`/api/v2/checkpaper`, `/api/v2/checkpaper/asset`, and the Carmodoo renderer
before changing the listing parser. Performance-check saving is intentionally
non-fatal; vehicle images and manuscript saving may still succeed.

## Verification

```bash
bun run test -- --run \
  src/app/api/v2/parse-truck \
  src/v2/shared/lib/__tests__/parse-truck-html.test.ts \
  src/v2/features/truck-processing

bun run test -- --run \
  src/v2/features/file-management/__tests__/text-content.test.ts \
  src/app/api/v2/checkpaper \
  src/v2/features/file-management/__tests__/performance-check-capture.test.ts

bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
bun run build
```

For certificate-chain changes, also repeat the real listing request through a
local Node server and its Vercel preview. Unit mocks prove error routing; they
do not prove the live source chain or deployment trust store.

## Related Decisions

- `docs/decisions/0002-client-parallel-vs-server-parallel.md`
- `docs/decisions/0004-concurrency-limiter-choice.md`
- `docs/decisions/0006-listing-source-tls-chain-recovery.md`
