# Runbook: Debug a Failed Scrape

Use this when the root app cannot load a truck listing, returns incomplete
data, or fails to discover the listing's performance-check link. Diagnose the
request layer before changing Cheerio selectors.

## Ownership Map

- URL allowlist and required parameters:
  `src/v2/entities/url/model.ts`
- Source request, timeout, and TLS recovery:
  `src/app/api/v2/parse-truck/fetch-listing-html.ts`
- Shared response byte limits, timeout cancellation, and Node-to-Web stream
  adaptation: `src/v2/shared/lib/bounded-response.ts`
- API validation and error mapping:
  `src/app/api/v2/parse-truck/route.ts`
- HTML selectors and listing semantics:
  `src/v2/shared/lib/parse-truck-html.ts`
- Performance-check proxy and renderer:
  `src/app/api/v2/checkpaper/` and
  `src/v2/features/file-management/performance-check-capture.ts`
- Performance-check redirect, timeout, and scoped TLS recovery:
  `src/v2/shared/lib/checkpaper-proxy.ts`
- Explicit performance-check not-registered contract:
  `src/v2/shared/lib/performance-check-contract.ts`

## Failure Classification

| Observation                                                                   | Likely layer           | First action                                                         |
| ----------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| API returns `400 invalid-address`                                             | URL contract           | Check hostname, path, and `ShopNo`, `MemberNo`, `OnCarNo`            |
| API returns `504 site-timeout`                                                | Source request budget  | Compare upstream response time with the 3.5-second budget            |
| Browser or `curl` succeeds, plain Node fetch fails with a missing-issuer code | TLS chain              | Follow the TLS diagnosis below                                       |
| API returns `200` with fallback copy or empty images                          | HTML parser            | Save a sanitized HTML fixture and inspect selectors                  |
| API returns `502 unknown` for non-chain errors                                | HTTP, TLS, or network  | Preserve the original cause; do not broaden the certificate fallback |
| Timely 2xx upstream still maps to 502 and its body is unusually large         | Response resource cap  | Compare declared and observed bytes with the limits below            |
| Listing parses but every performance-check save fails quickly                 | CheckPaper transport   | Reproduce the Autocafe redirect chain in Node                        |
| CheckPaper proxy returns typed `404 PERFORMANCE_CHECK_NOT_REGISTERED`         | Upstream record state  | Treat it as an absent record, not a transport or renderer outage     |
| CheckPaper proxy returns 200 but JPG creation fails                           | Renderer or asset path | Inspect the final URL, asset proxy, PDF, or Carmodoo renderer        |

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

## Diagnose Response Body Limits

Request timeouts do not bound memory. All listing and performance-check
responses therefore pass through `bounded-response.ts` before parsing,
rewriting, or returning bytes:

| Response class                          | Maximum decoded bytes |
| --------------------------------------- | --------------------- |
| Truck listing HTML                      | 2 MiB                 |
| Performance-check HTML and CSS          | 4 MiB                 |
| Performance-check PDF, image, or binary | 16 MiB                |

Treat `Content-Length` only as an early-rejection signal. The upstream may omit
it, provide an invalid value, use chunked encoding, or report a compressed
length. The cumulative chunks delivered to the application are the
authoritative count.

When a previously working response starts failing:

1. Record the final canonical URL, status, `Content-Type`, declared
   `Content-Length`, downloaded bytes, elapsed time, and provider.
2. Confirm the response is expected HTML, CSS, PDF, or image data rather than
   an upstream error page or redirect body.
3. Reproduce both a standard Fetch response and, when the exact missing-chain
   condition applies, the trusted-chain path.
4. Verify that overflow or timeout cancels the stream and that a fallback
   cancellation destroys the native HTTPS source.
5. Do not raise a limit from one production failure alone. Capture
   representative valid payload sizes, choose bounded headroom, assess
   serverless memory impact at concurrent request load, and update ADR-0008.

Required boundary tests cover a body just below the limit, exactly at the
limit, and one byte above it. At least one over-limit test must omit
`Content-Length` so the streamed counter—not only the header check—is proven.
The standard Fetch and trusted-chain fallback must use the same reader and
limit.

Do not “fix” an oversized response by:

- relying on the existing request timeout;
- trusting `Content-Length` without counting chunks;
- calling `text()`, `arrayBuffer()`, or `Buffer.concat` before checking size;
- applying a limit only to the TLS fallback;
- silently truncating HTML or binary data.

Truncation would feed malformed input to the parser or save a corrupt
performance record. The route must fail closed with its existing user-facing
error contract.

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

Start from the exact `performanceCheckUrl` returned by
`POST /api/v2/parse-truck`. A normal Truck No.1 link enters through Autocafe:

```bash
check_url='http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=2026300140712'

curl -sS -L -D - -o /dev/null --max-time 15 "$check_url"
```

The expected host sequence is:

```text
listing performanceCheckUrl: autocafe.co.kr HTTP
  -> proxy upgrades before transport
autocafe.co.kr HTTPS
  -> checkpaper.jmenetworks.co.kr or ck.carmodoo.com HTTPS
```

Then test the Autocafe HTTPS hop in plain Node:

```bash
node -e '
const url = process.argv[1]
fetch(url, { redirect: "manual" })
  .then((response) => console.log({
    status: response.status,
    location: response.headers.get("location"),
  }))
  .catch((error) => console.error({
    name: error.name,
    message: error.message,
    cause: error.cause,
  }))
' 'https://autocafe.co.kr/ASSO/CarCheck_Form.asp?OnCarNo=2026300140712'
```

If Node reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or another known
missing-issuer code, inspect the live chain:

```bash
openssl s_client \
  -connect autocafe.co.kr:443 \
  -servername autocafe.co.kr \
  -showcerts \
  -verify_return_error \
  </dev/null
```

The known 2026-07-31 incident served only the Autocafe leaf issued by
`GoGetSSL RSA DV CA`. The public intermediate reviewed for the scoped fallback
has fingerprint:

```text
43:CA:C3:1E:F8:E8:BA:1B:4B:16:B8:20:6E:4C:0A:26:
C5:BA:DB:2F:C3:AA:09:E9:01:70:E4:1B:66:C2:FD:64
```

The proxy still tries standard `fetch` first. Only an HTTPS request to exact
host `autocafe.co.kr` with a known missing-chain error uses Node's default
roots plus that reviewed intermediate. It keeps `rejectUnauthorized: true`,
reuses the current redirect request's `AbortSignal`, and does not reset the
4.5-second total budget.

Before any standard or trusted-chain request, the helper rebuilds the target
from a server-owned literal origin and encoded path/query components. It
rejects credentials, fragments, explicit ports, unsupported provider HTTP
URLs, overlong input, host-specific path mismatches, and unsafe redirect
targets. The legacy Autocafe HTTP input is rewritten to its fixed HTTPS origin
before any outbound request. Nested encoded dot segments and encoded path
separators are rejected before canonical encoding. A 400 response for one of
these cases is an intentional SSRF boundary, not an upstream outage.

Do not treat every 502 as this incident. Verify the exact error and host first.
In particular:

- a `404` with `x-performance-check-status: not_registered` and
  `PERFORMANCE_CHECK_NOT_REGISTERED` means the upstream page explicitly said
  no record is registered; it is not a system failure;
- a final CheckPaper 4xx/5xx is an upstream record failure;
- a successful proxy response with missing `.page`, invalid PDF, or empty
  Carmodoo images is a renderer/provider failure;
- an unsafe redirect is an allowlist rejection, not a TLS failure;
- expired, revoked, or hostname-invalid certificates must continue failing.

### Replace The Autocafe Intermediate

Replace the embedded certificate only if the live Autocafe leaf issuer changed
or the current intermediate expired.

1. Read the live leaf's Authority Information Access URL.
2. Download the candidate to a temporary path.
3. Inspect the candidate:

   ```bash
   candidate_certificate='/private/tmp/autocafe-intermediate.crt'

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

4. Confirm the candidate is a CA, its subject equals the leaf issuer, and it
   chains to a Node-trusted root.
5. Update the PEM, subject, fingerprint, expiration comment, ADR-0007, and
   `docs/references/autocafe-tls-chain.md` together.
6. Keep the exact hostname check, default root certificates,
   `rejectUnauthorized: true`, literal-origin/path policy, and shared timeout.
7. Run the focused tests and a live local proxy request through Next.

### Verify The Live Proxy

```bash
bun dev
```

In another terminal:

```bash
curl -sS -D - -o /dev/null --max-time 8 \
  'http://127.0.0.1:3000/api/v2/checkpaper?url=http%3A%2F%2Fautocafe.co.kr%2FASSO%2FCarCheck_Form_my.asp%3FOnCarNo%3D2026300140712'
```

For a record-bearing URL, require all of these:

1. HTTP 200;
2. `x-checkpaper-final-url` points to an allowlisted CheckPaper or Carmodoo
   record;
3. response time remains inside the route budget;
4. a browser save produces one or more JPGs in `성능점검기록부/`;
5. `performance_check_saved_count` and
   `performance_check_image_count` reflect the saved result.

Also exercise the explicit no-record response:

```bash
curl -sS -D - --max-time 8 \
  'http://127.0.0.1:3000/api/v2/checkpaper?url=http%3A%2F%2Fautocafe.co.kr%2FASSO%2FCarCheck_Form_my.asp%3FOnCarNo%3D2026300242743'
```

Require HTTP `404`, header
`x-performance-check-status: not_registered`, response code
`PERFORMANCE_CHECK_NOT_REGISTERED`, and the Korean message
`등록된 성능점검기록부가 없어요.` A browser save must still complete the vehicle
images and manuscript, label the card `등록된 성능점검기록부 없음`, and avoid the
generic `성능점검기록부 확인 필요` wording for this case.

Also verify that unsafe targets fail before an outbound request:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://127.0.0.1:3000/api/v2/checkpaper?url=https%3A%2F%2Fcheckpaper.jmenetworks.co.kr%3A8443%2FService%2FCheckPaper'
```

The expected status is 400. Regression coverage must include unsupported
hosts, explicit ports, URL credentials, provider HTTP downgrade, unsupported
paths, traversal-normalized and nested-encoded paths, encoded separators,
fragments, Autocafe HTTP-to-HTTPS upgrade, and query-component encoding.

ADR-0007 records why increasing the timeout, disabling TLS verification,
downgrading to HTTP, process-wide CA changes, and runtime AIA fetching were
rejected.

## Verification

```bash
bun run test -- --run \
  src/v2/shared/lib/__tests__/bounded-response.test.ts \
  src/app/api/v2/parse-truck \
  src/v2/shared/lib/__tests__/parse-truck-html.test.ts \
  src/v2/features/truck-processing

bun run test -- --run \
  src/v2/features/file-management/__tests__/text-content.test.ts \
  src/app/api/v2/checkpaper \
  src/v2/features/file-management/__tests__/performance-check-capture.test.ts \
  src/v2/features/file-management/__tests__/file-system.test.ts \
  src/v2/features/file-management/__tests__/zip-fallback.test.ts \
  src/v2/application/truck-harvester-workflow/workflow-analytics.test.ts \
  src/v2/widgets/processing-status/ui/__tests__/prepared-listing-status.test.tsx

bun run typecheck
bun run lint
bun run format:check
bun run test -- --run
bun run build
```

For certificate-chain changes, also repeat the real listing request through a
local Node server and its Vercel preview. For CheckPaper chain changes, repeat
the live `/api/v2/checkpaper` request and a browser folder-save smoke test. Unit
mocks prove error routing; they do not prove the live source chain, deployment
trust store, or JPG renderer.

## Related Decisions

- `docs/decisions/0002-client-parallel-vs-server-parallel.md`
- `docs/decisions/0004-concurrency-limiter-choice.md`
- `docs/decisions/0006-listing-source-tls-chain-recovery.md`
- `docs/decisions/0007-autocafe-tls-chain-recovery.md`
- `docs/decisions/0008-bounded-upstream-response-bodies.md`
- `docs/references/autocafe-tls-chain.md`
