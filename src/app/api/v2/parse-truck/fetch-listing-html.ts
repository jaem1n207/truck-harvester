import { request as requestHttps } from 'node:https'
import { rootCertificates } from 'node:tls'

const listingHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
}

const supportedHostname = 'www.truck-no1.co.kr'

const incompleteCertificateChainErrorCodes = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

/*
 * truck-no1.co.kr currently serves only its leaf certificate. Node does not
 * fetch the missing AIA intermediate automatically, so its otherwise valid
 * certificate cannot be verified in Vercel's Node runtime.
 *
 * Subject: Sectigo Public Server Authentication CA DV R36
 * SHA-256: 8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:
 *          19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0
 * Valid through: 2036-03-21
 */
const sectigoPublicServerAuthenticationCaDvR36 = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq
RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH
12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja
EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm
M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv
38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB
pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn
2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN
xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8
ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d
q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF
h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH
5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD
4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd
unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536
WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l
7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW
r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh
JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=
-----END CERTIFICATE-----`

const trustedCaCertificates = [
  ...rootCertificates,
  sectigoPublicServerAuthenticationCaDvR36,
]

type RegularFetch = (
  input: string,
  init: RequestInit
) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>

type TrustedChainFetch = (url: string, signal: AbortSignal) => Promise<string>

interface FetchListingHtmlDependencies {
  fetch?: RegularFetch
  fetchWithTrustedChain?: TrustedChainFetch
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIncompleteCertificateChainError(error: unknown) {
  let current = error

  for (let depth = 0; depth < 5 && isObject(current); depth += 1) {
    if (
      typeof current.code === 'string' &&
      incompleteCertificateChainErrorCodes.has(current.code)
    ) {
      return true
    }

    current = current.cause
  }

  return false
}

function fetchListingHtmlWithTrustedChain(
  url: string,
  signal: AbortSignal
): Promise<string> {
  const listingUrl = new URL(url)

  if (
    listingUrl.protocol !== 'https:' ||
    listingUrl.hostname !== supportedHostname
  ) {
    return Promise.reject(new Error('Unsupported trusted-chain host'))
  }

  return new Promise((resolve, reject) => {
    const request = requestHttps(
      listingUrl,
      {
        ca: trustedCaCertificates,
        headers: {
          ...listingHeaders,
          'Accept-Encoding': 'identity',
        },
        rejectUnauthorized: true,
        signal,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0

        if (statusCode < 200 || statusCode >= 300) {
          response.resume()
          reject(new Error(`HTTP ${statusCode}`))
          return
        }

        response.setEncoding('utf8')
        let html = ''

        response.on('data', (chunk) => {
          html += chunk
        })
        response.on('end', () => {
          resolve(html)
        })
        response.on('error', reject)
        response.on('aborted', () => {
          reject(new Error('Listing response aborted'))
        })
      }
    )

    request.on('error', reject)
    request.end()
  })
}

export async function fetchListingHtml(
  url: string,
  timeoutMs: number,
  dependencies: FetchListingHtmlDependencies = {}
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const regularFetch = dependencies.fetch ?? globalThis.fetch
  const fetchWithTrustedChain =
    dependencies.fetchWithTrustedChain ?? fetchListingHtmlWithTrustedChain

  try {
    try {
      const response = await regularFetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: listingHeaders,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      if (
        controller.signal.aborted ||
        !isIncompleteCertificateChainError(error)
      ) {
        throw error
      }

      return await fetchWithTrustedChain(url, controller.signal)
    }
  } finally {
    clearTimeout(timeout)
  }
}
