import { z } from 'zod'

export const pendingDownloadSchema = z.object({
  status: z.literal('pending'),
  truckId: z.string().min(1),
  totalImages: z.number().int().min(0).default(0),
})

export const downloadingSchema = z.object({
  status: z.literal('downloading'),
  truckId: z.string().min(1),
  downloadedImages: z.number().int().min(0),
  totalImages: z.number().int().min(0),
  progress: z.number().min(0).max(100),
})

export const downloadedSchema = z.object({
  status: z.literal('downloaded'),
  truckId: z.string().min(1),
  downloadedImages: z.number().int().min(0),
  totalImages: z.number().int().min(0),
  completedAt: z.string().datetime(),
})

export const failedDownloadSchema = z.object({
  status: z.literal('failed'),
  truckId: z.string().min(1),
  downloadedImages: z.number().int().min(0),
  totalImages: z.number().int().min(0),
  message: z.string().min(1),
  failedAt: z.string().datetime(),
})

export const skippedDownloadSchema = z.object({
  status: z.literal('skipped'),
  truckId: z.string().min(1),
  reason: z.string().min(1),
  skippedAt: z.string().datetime(),
})

export const downloadStatusSchema = z.discriminatedUnion('status', [
  pendingDownloadSchema,
  downloadingSchema,
  downloadedSchema,
  failedDownloadSchema,
  skippedDownloadSchema,
])

export type PendingDownload = z.infer<typeof pendingDownloadSchema>
export type Downloading = z.infer<typeof downloadingSchema>
export type Downloaded = z.infer<typeof downloadedSchema>
export type FailedDownload = z.infer<typeof failedDownloadSchema>
export type SkippedDownload = z.infer<typeof skippedDownloadSchema>
export type DownloadStatus = z.infer<typeof downloadStatusSchema>
