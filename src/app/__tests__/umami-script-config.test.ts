import { describe, expect, it } from 'vitest'

import { getUmamiScriptConfig } from '../umami-script-config'

describe('getUmamiScriptConfig', () => {
  it('uses the fixed Umami Cloud tracker in production', () => {
    expect(getUmamiScriptConfig({ NODE_ENV: 'production' })).toEqual({
      websiteId: '2f38de85-b68d-4309-a1e1-a0877abf4685',
      src: 'https://cloud.umami.is/script.js',
    })
  })

  it('disables the tracker outside production', () => {
    expect(getUmamiScriptConfig({ NODE_ENV: 'development' })).toBeNull()
  })
})
