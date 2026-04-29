import { describe, expect, it } from 'vitest'

import { getUmamiScriptConfig } from '../umami-script-config'

describe('getUmamiScriptConfig', () => {
  it('disables the tracker when no Umami website id is configured', () => {
    expect(getUmamiScriptConfig({})).toBeNull()
    expect(
      getUmamiScriptConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: '   ' })
    ).toBeNull()
  })

  it('uses the Umami Cloud script by default when a website id is configured', () => {
    expect(
      getUmamiScriptConfig({
        NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'website-123',
      })
    ).toEqual({
      websiteId: 'website-123',
      src: 'https://cloud.umami.is/script.js',
      domains: undefined,
    })
  })

  it('allows the script source and domain filter to come from env', () => {
    expect(
      getUmamiScriptConfig({
        NEXT_PUBLIC_UMAMI_WEBSITE_ID: ' website-123 ',
        NEXT_PUBLIC_UMAMI_SCRIPT_SRC:
          ' https://analytics.example.com/script.js ',
        NEXT_PUBLIC_UMAMI_DOMAINS:
          ' truck-harvester.vercel.app,www.example.com ',
      })
    ).toEqual({
      websiteId: 'website-123',
      src: 'https://analytics.example.com/script.js',
      domains: 'truck-harvester.vercel.app,www.example.com',
    })
  })
})
