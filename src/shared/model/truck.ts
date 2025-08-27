import { z } from 'zod'

export const truckDataSchema = z.object({
  url: z.string().url(),
  vname: z.string(), // 차명 (p.vname)
  vnumber: z.string(), // 차량번호 (p.vnumber)
  title: z.string(), // 기존 제목 (호환성 유지)
  price: z.object({
    raw: z.number(), // 숫자 가격 (만원 단위)
    rawWon: z.number(), // 원 단위 가격
    label: z.string(), // "3,550만원" 형태
    compactLabel: z.string(), // "35.5억" 등 축약형
  }),
  year: z.string(), // 연식
  mileage: z.string(), // 주행거리 (숫자 + km)
  options: z.string(), // 기타사항/옵션
  firstRegistration: z.string(), // 기존 필드 (호환성 유지)
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
  vehicleNumber: z.string(), // 호환성 유지를 위해 유지하되, 실제로는 vnumber 값을 사용
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