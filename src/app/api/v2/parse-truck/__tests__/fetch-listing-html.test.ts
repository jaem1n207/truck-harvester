import { describe, expect, it, vi } from 'vitest'

import { fetchListingHtml } from '../fetch-listing-html'

const validUrl =
  'https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=30195108&MemberNo=1000294965&OnCarNo=2026300212151'

const listingHtml = '<!doctype html><p class="vname">현대 마이티</p>'

function createCertificateChainError() {
  const cause = Object.assign(
    new Error('unable to verify the first certificate'),
    {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    }
  )

  return new TypeError('fetch failed', { cause })
}

describe('fetchListingHtml', () => {
  it('retries with the trusted intermediate chain when the source omits it', async () => {
    const regularFetch = vi
      .fn()
      .mockRejectedValue(createCertificateChainError())
    const fetchWithTrustedChain = vi.fn().mockResolvedValue(
      new Response(listingHtml, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      })
    )

    await expect(
      fetchListingHtml(validUrl, 3500, {
        fetch: regularFetch,
        fetchWithTrustedChain,
      })
    ).resolves.toBe(listingHtml)

    expect(regularFetch).toHaveBeenCalledOnce()
    expect(fetchWithTrustedChain).toHaveBeenCalledWith(
      validUrl,
      expect.any(AbortSignal)
    )
  })

  it('rejects an oversized body from the regular fetch path', async () => {
    const regularFetch = vi.fn().mockResolvedValue(
      new Response('small', {
        headers: {
          'content-length': String(2 * 1024 * 1024 + 1),
          'content-type': 'text/html; charset=utf-8',
        },
      })
    )

    await expect(
      fetchListingHtml(validUrl, 3500, {
        fetch: regularFetch,
      })
    ).rejects.toMatchObject({
      code: 'RESPONSE_BODY_TOO_LARGE',
    })
  })

  it('rejects an oversized body from the trusted-chain fallback path', async () => {
    const regularFetch = vi
      .fn()
      .mockRejectedValue(createCertificateChainError())
    const fetchWithTrustedChain = vi.fn().mockResolvedValue(
      new Response('small', {
        headers: {
          'content-length': String(2 * 1024 * 1024 + 1),
          'content-type': 'text/html; charset=utf-8',
        },
      })
    )

    await expect(
      fetchListingHtml(validUrl, 3500, {
        fetch: regularFetch,
        fetchWithTrustedChain,
      })
    ).rejects.toMatchObject({
      code: 'RESPONSE_BODY_TOO_LARGE',
    })
  })

  it('does not bypass unrelated TLS or network failures', async () => {
    const unrelatedError = Object.assign(new Error('certificate expired'), {
      code: 'CERT_HAS_EXPIRED',
    })
    const regularFetch = vi.fn().mockRejectedValue(unrelatedError)
    const fetchWithTrustedChain = vi.fn()

    await expect(
      fetchListingHtml(validUrl, 3500, {
        fetch: regularFetch,
        fetchWithTrustedChain,
      })
    ).rejects.toBe(unrelatedError)

    expect(fetchWithTrustedChain).not.toHaveBeenCalled()
  })
})
