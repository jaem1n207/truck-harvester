import { describe, expect, it } from 'vitest'

import { downloadStatusSchema, type DownloadStatus } from '../model'

describe('downloadStatusSchema', () => {
  it('parses every download state used by the batch flow', () => {
    const statuses = [
      {
        status: 'pending',
        truckId: 'truck-1',
        totalImages: 3,
      },
      {
        status: 'downloading',
        truckId: 'truck-1',
        downloadedImages: 1,
        totalImages: 3,
        progress: 33,
      },
      {
        status: 'downloaded',
        truckId: 'truck-1',
        downloadedImages: 3,
        totalImages: 3,
        completedAt: '2026-04-26T00:00:00.000Z',
      },
      {
        status: 'failed',
        truckId: 'truck-1',
        downloadedImages: 1,
        totalImages: 3,
        message: '사진 저장 중 문제가 생겼습니다.',
        failedAt: '2026-04-26T00:00:00.000Z',
      },
      {
        status: 'skipped',
        truckId: 'truck-1',
        reason: '직원이 건너뛰었습니다.',
        skippedAt: '2026-04-26T00:00:00.000Z',
      },
    ]

    expect(
      statuses.map((status) => downloadStatusSchema.parse(status))
    ).toEqual(statuses)
  })

  it('narrows resolved states for completion checks', () => {
    const status: DownloadStatus = downloadStatusSchema.parse({
      status: 'skipped',
      truckId: 'truck-1',
      reason: '직원이 건너뛰었습니다.',
      skippedAt: '2026-04-26T00:00:00.000Z',
    })

    const isResolved =
      status.status === 'downloaded' || status.status === 'skipped'

    expect(isResolved).toBe(true)
  })

  it('rejects invalid progress values', () => {
    const result = downloadStatusSchema.safeParse({
      status: 'downloading',
      truckId: 'truck-1',
      downloadedImages: 4,
      totalImages: 3,
      progress: 120,
    })

    expect(result.success).toBe(false)
  })
})
