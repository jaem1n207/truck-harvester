import { z } from 'zod'

const allowedDomains = ['www.truck-no1.co.kr'] as const
const allowedPaths = ['/model/DetailView.asp'] as const
const legacyDetailParams = ['ShopNo', 'MemberNo', 'OnCarNo'] as const
const encryptedDetailParam = 'encOnCarNo'
const listingIdentityParams = [
  ...legacyDetailParams,
  encryptedDetailParam,
] as const

const hasParamValue = (url: URL, param: string) =>
  Boolean(url.searchParams.get(param)?.trim())

const hasLegacyIdentity = (url: URL) =>
  legacyDetailParams.every((param) => hasParamValue(url, param))

const hasEncryptedIdentity = (url: URL) =>
  hasParamValue(url, encryptedDetailParam)

const hasDuplicateIdentity = (url: URL) =>
  listingIdentityParams.some(
    (param) => url.searchParams.getAll(param).length > 1
  )

const hasListingIdentity = (url: URL) =>
  !hasDuplicateIdentity(url) &&
  (hasLegacyIdentity(url) || hasEncryptedIdentity(url))

export function hasOpaqueTruckIdentity(rawUrl: string) {
  try {
    return new URL(rawUrl).searchParams.has(encryptedDetailParam)
  } catch {
    return false
  }
}

export const normalizedTruckUrlSchema = z
  .string()
  .trim()
  .url()
  .transform((value) => {
    const url = new URL(value)
    url.protocol = 'https:'
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    return url.toString()
  })
  .pipe(
    z.string().superRefine((value, context) => {
      const url = new URL(value)

      if (
        !allowedDomains.includes(
          url.hostname as (typeof allowedDomains)[number]
        )
      ) {
        context.addIssue({
          code: 'custom',
          message: '지원하는 매물 사이트 주소만 사용할 수 있습니다.',
        })
      }

      if (
        !allowedPaths.includes(url.pathname as (typeof allowedPaths)[number])
      ) {
        context.addIssue({
          code: 'custom',
          message: '매물 상세 화면 주소만 사용할 수 있습니다.',
        })
      }

      if (!hasListingIdentity(url)) {
        context.addIssue({
          code: 'custom',
          message: '매물 주소에 필요한 정보가 빠져 있습니다.',
        })
      }
    })
  )

export const truckUrlInputSchema = z.object({
  id: z.string().min(1),
  rawUrl: z.string().min(1),
  normalizedUrl: normalizedTruckUrlSchema,
})

export type TruckUrlInput = z.infer<typeof truckUrlInputSchema>
export type NormalizedTruckUrl = z.infer<typeof normalizedTruckUrlSchema>

export function normalizeTruckUrl(rawUrl: string): NormalizedTruckUrl {
  return normalizedTruckUrlSchema.parse(rawUrl)
}
