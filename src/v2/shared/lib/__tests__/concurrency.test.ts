import { describe, expect, it } from 'vitest'

import { runConcurrent } from '../concurrency'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('runConcurrent', () => {
  it('never runs more than the configured number of jobs at once', async () => {
    let active = 0
    let maxActive = 0

    const results = await runConcurrent({
      items: [1, 2, 3, 4, 5],
      limit: 2,
      task: async (item) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await delay(5)
        active -= 1
        return item * 2
      },
    })

    expect(maxActive).toBe(2)
    expect(results).toEqual([
      { status: 'fulfilled', index: 0, item: 1, value: 2 },
      { status: 'fulfilled', index: 1, item: 2, value: 4 },
      { status: 'fulfilled', index: 2, item: 3, value: 6 },
      { status: 'fulfilled', index: 3, item: 4, value: 8 },
      { status: 'fulfilled', index: 4, item: 5, value: 10 },
    ])
  })

  it('keeps draining the queue when one job fails', async () => {
    const settled = await runConcurrent({
      items: ['a', 'b', 'c'],
      limit: 2,
      task: async (item) => {
        if (item === 'b') {
          throw new Error('bad item')
        }
        return item.toUpperCase()
      },
    })

    expect(settled[0]).toEqual({
      status: 'fulfilled',
      index: 0,
      item: 'a',
      value: 'A',
    })
    expect(settled[1]).toMatchObject({
      status: 'rejected',
      index: 1,
      item: 'b',
    })
    expect(settled[2]).toEqual({
      status: 'fulfilled',
      index: 2,
      item: 'c',
      value: 'C',
    })
  })

  it('does not start work when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    let started = 0

    const settled = await runConcurrent({
      items: ['a', 'b'],
      limit: 2,
      signal: controller.signal,
      task: async (item) => {
        started += 1
        return item.toUpperCase()
      },
    })

    expect(started).toBe(0)
    expect(settled).toMatchObject([
      { status: 'rejected', index: 0, item: 'a' },
      { status: 'rejected', index: 1, item: 'b' },
    ])
  })
})
