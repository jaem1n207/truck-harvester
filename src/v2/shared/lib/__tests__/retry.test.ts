import { describe, expect, it } from 'vitest'

import { retryOperation } from '../retry'

describe('retryOperation', () => {
  it('retries a failed operation and returns the first success', async () => {
    let attempts = 0

    const result = await retryOperation(
      async () => {
        attempts += 1
        if (attempts < 3) {
          throw new Error('temporary')
        }
        return 'success'
      },
      {
        retries: 2,
        wait: async () => undefined,
      }
    )

    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  it('throws the last error after retries are exhausted', async () => {
    let attempts = 0

    await expect(
      retryOperation(
        async () => {
          attempts += 1
          throw new Error(`failure ${attempts}`)
        },
        {
          retries: 2,
          wait: async () => undefined,
        }
      )
    ).rejects.toThrow('failure 3')
    expect(attempts).toBe(3)
  })
})
