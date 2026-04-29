const defaultUmamiCloudScriptSrc = 'https://cloud.umami.is/script.js'

interface UmamiScriptEnv extends Record<string, string | undefined> {
  NEXT_PUBLIC_UMAMI_WEBSITE_ID?: string
  NEXT_PUBLIC_UMAMI_SCRIPT_SRC?: string
  NEXT_PUBLIC_UMAMI_DOMAINS?: string
}

export interface UmamiScriptConfig {
  websiteId: string
  src: string
  domains?: string
}

const cleanOptionalEnv = (value: string | undefined) => {
  const trimmedValue = value?.trim()

  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined
}

export function getUmamiScriptConfig(
  env: UmamiScriptEnv = process.env
): UmamiScriptConfig | null {
  const websiteId = cleanOptionalEnv(env.NEXT_PUBLIC_UMAMI_WEBSITE_ID)

  if (!websiteId) {
    return null
  }

  return {
    websiteId,
    src:
      cleanOptionalEnv(env.NEXT_PUBLIC_UMAMI_SCRIPT_SRC) ??
      defaultUmamiCloudScriptSrc,
    domains: cleanOptionalEnv(env.NEXT_PUBLIC_UMAMI_DOMAINS),
  }
}
