const umamiCloudScriptSrc = 'https://cloud.umami.is/script.js'
const truckHarvesterWebsiteId = '2f38de85-b68d-4309-a1e1-a0877abf4685'

interface UmamiScriptEnv extends Record<string, string | undefined> {
  NODE_ENV?: string
}

export interface UmamiScriptConfig {
  websiteId: string
  src: string
}

export function getUmamiScriptConfig(
  env: UmamiScriptEnv = process.env
): UmamiScriptConfig | null {
  if (env.NODE_ENV !== 'production') {
    return null
  }

  return {
    websiteId: truckHarvesterWebsiteId,
    src: umamiCloudScriptSrc,
  }
}
