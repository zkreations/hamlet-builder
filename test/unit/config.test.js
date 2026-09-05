import { lilconfig } from 'lilconfig'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getConfig, loadConfigurations } from '../../lib/config.js'

vi.mock('lilconfig', () => {
  return {
    lilconfig: vi.fn(),
  }
})

describe('configuration loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('provides default fallback configuration when no config files exist', async () => {
    lilconfig.mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    })

    const context = {
      paths: { root: '/test', src: '/test/src', dist: '/test/dist' },
      utils: { resolve: (...args) => args.join('/') },
    }

    const configs = await loadConfigurations(context)

    expect(configs.postcss).toEqual({ plugins: [] })
    expect(configs.rollup).toEqual({ plugins: [] })
    expect(configs.hamlet).toEqual({
      recompileOnAnyChange: false,
      helpers: {},
      plugins: [],
    })
    expect(configs.theme).toEqual({})
  })

  it('resolves function configuration passing context and merges with fallback', async () => {
    const mockContext = {
      paths: { root: '/app', src: '/app/src', dist: '/app/dist' },
      utils: { resolve: path => `/app/${path}` },
    }

    const mockHamletFn = vi.fn(ctx => ({
      recompileOnAnyChange: true,
      helpers: { custom: () => ctx.paths.root },
    }))

    lilconfig.mockImplementation((name) => {
      if (name === 'hamlet') {
        return {
          search: vi.fn().mockResolvedValue({ config: mockHamletFn }),
        }
      }
      if (name === 'theme') {
        return {
          search: vi.fn().mockResolvedValue({ config: { siteName: 'Hamlet Test' } }),
        }
      }
      return {
        search: vi.fn().mockResolvedValue(null),
      }
    })

    const configs = await loadConfigurations(mockContext)

    expect(mockHamletFn).toHaveBeenCalledWith(mockContext)
    expect(configs.hamlet.recompileOnAnyChange).toBe(true)
    expect(configs.hamlet.plugins).toEqual([]) // Preserved from fallback
    expect(typeof configs.hamlet.helpers.custom).toBe('function')
    expect(configs.theme).toEqual({ siteName: 'Hamlet Test' })
  })

  it('getConfig returns null when search finds nothing', async () => {
    lilconfig.mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    })

    const result = await getConfig('hamlet')
    expect(result).toBeNull()
  })
})
