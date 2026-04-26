import { z } from 'zod'

import { truckListingSchema, type TruckListing } from '@/v2/entities/truck'

const parseTruckSuccessSchema = z.object({
  success: z.literal(true),
  data: truckListingSchema,
})

const parseTruckFailureSchema = z.object({
  success: z.literal(false),
  reason: z.string(),
  message: z.string().min(1),
})

const parseTruckResponseSchema = z.discriminatedUnion('success', [
  parseTruckSuccessSchema,
  parseTruckFailureSchema,
])

interface ParseTruckListingInput {
  url: string
  timeoutMs?: number
  signal?: AbortSignal
}

export async function parseTruckListing({
  url,
  timeoutMs = 3500,
  signal,
}: ParseTruckListingInput): Promise<TruckListing> {
  const response = await fetch('/api/v2/parse-truck', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, timeoutMs }),
    signal,
  })
  const payload = parseTruckResponseSchema.parse(await response.json())

  if (!payload.success) {
    throw new Error(payload.message)
  }

  return payload.data
}
