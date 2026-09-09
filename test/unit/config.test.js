import fs from 'node:fs'
import path from 'node:path'
import { lilconfig } from 'lilconfig'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getConfig, loadConfigurations } from '../../lib/config.js'
import { createTempDir } from '../helpers/temp.js'

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
      resolveMarkups: true,
      mergeMarkups: false,
      helpers: {},
      plugins: [],
      sourcemap: false,
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
    expect(configs.hamlet.resolveMarkups).toBe(true)
    expect(configs.hamlet.mergeMarkups).toBe(false)
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

  it('dynamic loader loads ESM config files with default or named exports', async () => {
    lilconfig.mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    })

    const context = {
      paths: { root: '/fresh-test', src: '/fresh-test/src', dist: '/fresh-test/dist' },
      utils: { resolve: (...args) => args.join('/') },
    }

    await loadConfigurations(context, { fresh: true })

    const lastCall = lilconfig.mock.calls.find(call => call[0] === 'hamlet')
    const dynamicLoader = lastCall[1].loaders['.mjs']

    const tmp = createTempDir('hamlet-cfg-test-')
    const configPath1 = path.join(tmp.dir, 'hamlet.config.mjs')
    const configPath2 = path.join(tmp.dir, 'theme.config.mjs')

    try {
      fs.writeFileSync(configPath1, 'export default { recompileOnAnyChange: true, title: "Hamlet" };')
      const loaded1 = await dynamicLoader(configPath1)
      expect(loaded1).toEqual({ recompileOnAnyChange: true, title: 'Hamlet' })

      fs.writeFileSync(configPath2, 'export const setting = "enabled";')
      const loaded2 = await dynamicLoader(configPath2)
      expect(loaded2.setting).toBe('enabled')
    }
    finally {
      tmp.cleanup()
    }
  })

  it('dynamic loader re-throws syntax errors encountered in config files', async () => {
    lilconfig.mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    })

    await loadConfigurations({}, { fresh: false })
    const lastCall = lilconfig.mock.calls.find(call => call[0] === 'hamlet')
    const dynamicLoader = lastCall[1].loaders['.js']

    const tmp = createTempDir('hamlet-cfg-err-')
    const badConfigPath = path.join(tmp.dir, 'broken.config.js')

    try {
      fs.writeFileSync(badConfigPath, 'export default { invalid: syntax: error };')
      await expect(dynamicLoader(badConfigPath)).rejects.toThrow()
    }
    finally {
      tmp.cleanup()
    }
  })
})
