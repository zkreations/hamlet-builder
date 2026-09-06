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

  it('correctly identifies project configuration files with isConfigFile', async () => {
    const { isConfigFile } = await import('../../lib/config.js')

    const root = '/my/project'

    // Supported configs in root
    expect(isConfigFile('hamlet.config.js', root)).toBe(true)
    expect(isConfigFile('theme.config.mjs', root)).toBe(true)
    expect(isConfigFile('postcss.config.cjs', root)).toBe(true)
    expect(isConfigFile('rollup.config.js', root)).toBe(true)
    expect(isConfigFile('.hamletrc.json', root)).toBe(true)
    expect(isConfigFile('.themerc', root)).toBe(true)
    expect(isConfigFile('package.json', root)).toBe(true)

    // Supported configs in .config/
    expect(isConfigFile('.config/hamletrc.js', root)).toBe(true)
    expect(isConfigFile('.config/themerc.json', root)).toBe(true)

    // Absolute paths
    expect(isConfigFile('/my/project/hamlet.config.js', root)).toBe(true)

    // Non-config files
    expect(isConfigFile('src/index.js', root)).toBe(false)
    expect(isConfigFile('src/hamlet.config.js', root)).toBe(false)
    expect(isConfigFile('styles/main.scss', root)).toBe(false)
    expect(isConfigFile('vite.config.js', root)).toBe(false)
    expect(isConfigFile('README.md', root)).toBe(false)
  })

  it('passes cache: false to lilconfig when fresh: true is requested', async () => {
    lilconfig.mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    })

    const context = {
      paths: { root: '/fresh-test', src: '/fresh-test/src', dist: '/fresh-test/dist' },
      utils: { resolve: (...args) => args.join('/') },
    }

    await loadConfigurations(context, { fresh: true })

    expect(lilconfig).toHaveBeenCalledWith(
      'hamlet',
      expect.objectContaining({
        cache: false,
        loaders: expect.objectContaining({
          '.js': expect.any(Function),
          '.mjs': expect.any(Function),
          '.cjs': expect.any(Function),
        }),
      }),
    )
  })
})
