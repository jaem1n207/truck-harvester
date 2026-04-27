import { describe, expect, it, vi } from 'vitest'

const redirectMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

describe('V2 compatibility route', () => {
  it('redirects old /v2 links to the root app', async () => {
    const V2Page = (await import('../page')).default

    V2Page()

    expect(redirectMock).toHaveBeenCalledWith('/')
  })
})
