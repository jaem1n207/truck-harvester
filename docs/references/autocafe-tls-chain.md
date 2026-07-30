# Autocafe TLS Chain Evidence

This reference records the external evidence behind ADR-0007. It is not a
private key, credential, or production secret.

## Incident Snapshot

Observed on 2026-07-31:

```text
http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=2026300140712
  302 -> https://autocafe.co.kr/ASSO/CarCheck_Form.asp?OnCarNo=2026300140712
  302 -> https://checkpaper.jmenetworks.co.kr/Service/CheckPaper?checkNo=4107101989...
  200
```

Plain Node succeeded for the initial HTTP and final CheckPaper requests but
failed on the Autocafe HTTPS hop:

```text
TypeError: fetch failed
cause.code: UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

`openssl s_client` showed one served certificate:

- Leaf subject: `CN=autocafe.co.kr`
- Leaf issuer: `C=LV, L=Riga, O=GoGetSSL, CN=GoGetSSL RSA DV CA`
- Leaf validity: 2026-06-11 through 2026-12-26
- Verification result: `unable to get local issuer certificate`

The leaf Authority Information Access field identified:

```text
http://crt.usertrust.com/GoGetSSLRSADVCA.crt
```

The downloaded public intermediate had:

- Subject: `C=LV, L=Riga, O=GoGetSSL, CN=GoGetSSL RSA DV CA`
- Issuer:
  `C=US, ST=New Jersey, L=Jersey City, O=The USERTRUST Network, CN=USERTrust RSA Certification Authority`
- Validity: 2018-09-06 through 2028-09-05
- SHA-256:
  `43:CA:C3:1E:F8:E8:BA:1B:4B:16:B8:20:6E:4C:0A:26:C5:BA:DB:2F:C3:AA:09:E9:01:70:E4:1B:66:C2:FD:64`

Node HTTPS with its default roots plus that PEM returned the expected Autocafe
302 while keeping `rejectUnauthorized: true`.

## Reproduction Commands

Inspect the redirects:

```bash
check_url='http://autocafe.co.kr/ASSO/CarCheck_Form_my.asp?OnCarNo=2026300140712'

curl -sS -L -D - -o /dev/null --max-time 15 "$check_url"
```

Compare Node:

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

Inspect the served chain:

```bash
openssl s_client \
  -connect autocafe.co.kr:443 \
  -servername autocafe.co.kr \
  -showcerts \
  -verify_return_error \
  </dev/null
```

Inspect a candidate downloaded from the current leaf AIA:

```bash
candidate_certificate='/private/tmp/GoGetSSLRSADVCA.crt'

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

Do not assume this snapshot remains current. Re-read the live leaf certificate
before replacing trust material.

## Authoritative References

- Node TLS CA behavior: <https://nodejs.org/api/tls.html>
- Sectigo intermediate certificate guidance:
  <https://www.sectigo.com/knowledge-base/detail/Sectigo-Intermediate-Certificates>
