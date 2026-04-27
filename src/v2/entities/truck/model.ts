import { z } from 'zod'

export const truckPriceSchema = z.object({
  raw: z.number().int().min(0),
  rawWon: z.number().int().min(0),
  label: z.string().min(1),
  compactLabel: z.string().min(1),
})

export const truckListingSchema = z.object({
  url: z.string().url(),
  vname: z.string().min(1),
  vehicleName: z.string().min(1),
  vnumber: z.string().min(1),
  price: truckPriceSchema,
  year: z.string().min(1),
  mileage: z.string().min(1),
  options: z.string().min(1),
  images: z.array(z.string().url()).default([]),
})

export const pendingTruckSchema = z.object({
  status: z.literal('pending'),
  id: z.string().min(1),
  url: z.string().url(),
})

export const successTruckSchema = z.object({
  status: z.literal('success'),
  id: z.string().min(1),
  url: z.string().url(),
  listing: truckListingSchema,
  parsedAt: z.string().datetime(),
})

export const failedTruckSchema = z.object({
  status: z.literal('failed'),
  id: z.string().min(1),
  url: z.string().url(),
  reason: z.enum([
    'deleted-listing',
    'invalid-address',
    'site-timeout',
    'missing-data',
    'unknown',
  ]),
  message: z.string().min(1),
  failedAt: z.string().datetime(),
})

export const truckParseResultSchema = z.discriminatedUnion('status', [
  pendingTruckSchema,
  successTruckSchema,
  failedTruckSchema,
])

export type TruckPrice = z.infer<typeof truckPriceSchema>
export type TruckListing = z.infer<typeof truckListingSchema>
export type PendingTruck = z.infer<typeof pendingTruckSchema>
export type SuccessTruck = z.infer<typeof successTruckSchema>
export type FailedTruck = z.infer<typeof failedTruckSchema>
export type TruckParseResult = z.infer<typeof truckParseResultSchema>
