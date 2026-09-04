import { describe, expect, it } from 'vitest'
import { loadConfigurations } from '../../lib/config.js'

describe('configuration loader', () => {
  it('provides default fallback configuration when no config files exist', async () => {
    const context = {
      paths: { root: '/test', src: '/test/src', dist: '/test/dist' },
      utils: { resolve: (...args) => args.join('/') },
    }

    const configs = await loadConfigurations(context)

    expect(configs).toBeDefined()
    expect(configs.postcss).toBeDefined()
    expect(configs.postcss.plugins).toEqual([])
    expect(configs.rollup).toBeDefined()
    expect(configs.rollup.plugins).toEqual([])
    expect(configs.hamlet).toBeDefined()
    expect(configs.hamlet.recompileOnAnyChange).toBe(false)
    expect(configs.hamlet.plugins).toEqual([])
    expect(configs.hamlet.helpers).toEqual({})
  })
})
