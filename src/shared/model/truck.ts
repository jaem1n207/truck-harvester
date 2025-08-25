import { z } from 'zod'

export const truckDataSchema = z.object({
  url: z.string().url(),
  vehicleNumber: z.string(),
  title: z.string(),
  price: z.object({
    raw: z.number(),
    label: z.string(),
  }),
  firstRegistration: z.string(),
  mileage: z.string(),
  images: z.array(z.string()),
  error: z.string().optional(),
})

export const parseRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1),
  rateLimitMs: z.number().min(100).default(1000),
  timeoutMs: z.number().min(1000).default(10000),
})

export const parseResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(truckDataSchema).optional(),
  error: z.string().optional(),
  details: z.any().optional(),
  summary: z.object({
    total: z.number(),
    success: z.number(),
    failed: z.number(),
  }).optional(),
})

export const downloadStatusSchema = z.object({
  vehicleNumber: z.string(),
  status: z.enum(['pending', 'downloading', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  error: z.string().optional(),
  downloadedImages: z.number().default(0),
  totalImages: z.number().default(0),
})

export const appConfigSchema = z.object({
  selectedDirectory: z.string().optional(),
  rateLimitMs: z.number().min(100).default(1000),
  timeoutMs: z.number().min(1000).default(10000),
  maxRetries: z.number().min(0).max(5).default(3),
})

export type TruckData = z.infer<typeof truckDataSchema>
export type ParseRequest = z.infer<typeof parseRequestSchema>
export type ParseResponse = z.infer<typeof parseResponseSchema>
export type DownloadStatus = z.infer<typeof downloadStatusSchema>
export type AppConfig = z.infer<typeof appConfigSchema>