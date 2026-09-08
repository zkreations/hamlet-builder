import chokidar from 'chokidar'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileStyle } from '../../lib/compilers/css.js'
import { clearBundleCache, compileJS } from '../../lib/compilers/js.js'
import { compileXML } from '../../lib/compilers/xml.js'
import { loadConfigurations } from '../../lib/config.js'
import { watchMode } from '../../lib/modes/watch.js'
import { logger } from '../../lib/utils/logger.js'

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  },
}))

vi.mock('../../lib/config.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loadConfigurations: vi.fn(),
  }
})

vi.mock('../../lib/compilers/js.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    clearBundleCache: vi.fn(),
    compileJS: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../lib/compilers/css.js', () => ({
  compileStyle: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/compilers/xml.js', () => ({
  compileXML: vi.fn().mockResolvedValue(undefined),
}))

describe('watchMode configuration and execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('configures chokidar and ignores output directory to prevent infinite loops', () => {
    const options = {
      input: './src',
      output: './dist',
      hamlet: {},
    }

    const watcher = watchMode(options)
    expect(watcher).toBeDefined()
    expect(chokidar.watch).toHaveBeenCalledWith(
      expect.arrayContaining(['./src']),
      expect.objectContaining({
        ignored: expect.arrayContaining(['./dist']),
        ignoreInitial: true,
      }),
    )
  })

  it('includes config candidate files in watch targets', () => {
    const options = {
      input: './src',
      output: './dist',
      cwd: '/test/app',
      hamlet: {},
    }

    watchMode(options)
    const [targets] = vi.mocked(chokidar.watch).mock.calls[0]

    expect(targets).toEqual(expect.arrayContaining([
      './src',
      expect.stringMatching(/hamlet\.config\.js$/),
      expect.stringMatching(/theme\.config\.js$/),
      expect.stringMatching(/postcss\.config\.js$/),
      expect.stringMatching(/rollup\.config\.js$/),
      expect.stringMatching(/package\.json$/),
    ]))
  })

  it('ignored filter allows config dotfiles but ignores other dotfiles', () => {
    const options = {
      input: './src',
      output: './dist',
      cwd: '/test/app',
      hamlet: {},
    }

    watchMode(options)
    const [, config] = vi.mocked(chokidar.watch).mock.calls[0]
    const ignoredFilter = config.ignored.find(item => typeof item === 'function')

    expect(ignoredFilter).toBeDefined()
    // Should ignore arbitrary dotfiles
    expect(ignoredFilter('/test/app/.DS_Store')).toBe(true)
    expect(ignoredFilter('/test/app/.editorconfig')).toBe(true)
    // Should NOT ignore config dotfiles
    expect(ignoredFilter('/test/app/.hamletrc.json')).toBe(false)
    expect(ignoredFilter('/test/app/.themerc.js')).toBe(false)
    expect(ignoredFilter('/test/app/.config')).toBe(false)
    // Should NOT ignore normal files
    expect(ignoredFilter('/test/app/src/index.js')).toBe(false)
  })

  it('cancels pending debounce timers when watcher.close is called', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    let eventHandler = null

    vi.mocked(chokidar.watch).mockReturnValueOnce({
      on: vi.fn((event, handler) => {
        if (event === 'all')
          eventHandler = handler
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    const options = {
      input: './src',
      output: './dist',
      debounceDelay: 500,
    }

    const watcher = watchMode(options)
    expect(eventHandler).toBeDefined()

    // Trigger a file change event to schedule debounceTimeout
    eventHandler('change', './src/main.js')

    // Close the watcher before debounce expires
    await watcher.close()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('reloads configuration and recompiles assets when a config file changes', async () => {
    let eventHandler = null
    const reloadSpy = vi.spyOn(logger, 'reload')

    vi.mocked(chokidar.watch).mockReturnValueOnce({
      on: vi.fn((event, handler) => {
        if (event === 'all')
          eventHandler = handler
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    const newMockConfig = {
      postcss: { plugins: ['mock-postcss'] },
      rollup: { plugins: ['mock-rollup'] },
      hamlet: { recompileOnAnyChange: true },
      theme: { title: 'New Title' },
    }
    vi.mocked(loadConfigurations).mockResolvedValueOnce(newMockConfig)

    const options = {
      input: './src',
      output: './dist',
      cwd: '/test/app',
      debounceDelay: 10,
    }

    const watcher = watchMode(options)
    expect(eventHandler).toBeDefined()

    // Simulate modifying theme.config.js
    eventHandler('change', '/test/app/theme.config.js')

    // Wait for debounce to execute
    await new Promise(resolve => setTimeout(resolve, 30))

    expect(clearBundleCache).toHaveBeenCalled()
    expect(loadConfigurations).toHaveBeenCalledWith(
      expect.anything(),
      { fresh: true },
    )
    expect(options.postcss).toEqual(newMockConfig.postcss)
    expect(options.rollup).toEqual(newMockConfig.rollup)
    expect(options.hamlet).toEqual(newMockConfig.hamlet)
    expect(options.theme).toEqual(newMockConfig.theme)

    expect(reloadSpy).toHaveBeenCalledWith('Configuration changed, reloading...')
    expect(compileJS).toHaveBeenCalled()
    expect(compileStyle).toHaveBeenCalled()
    expect(compileXML).toHaveBeenCalled()

    await watcher.close()
  })

  it('handles broken configuration reloading gracefully without crashing', async () => {
    let eventHandler = null
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const watchSpy = vi.spyOn(logger, 'watch')

    vi.mocked(chokidar.watch).mockReturnValueOnce({
      on: vi.fn((event, handler) => {
        if (event === 'all')
          eventHandler = handler
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    vi.mocked(loadConfigurations).mockRejectedValueOnce(new Error('Syntax error in config file'))

    const options = {
      input: './src',
      output: './dist',
      cwd: '/test/app',
      debounceDelay: 10,
    }

    const watcher = watchMode(options)
    eventHandler('change', '/test/app/hamlet.config.js')

    await new Promise(resolve => setTimeout(resolve, 30))

    expect(errorSpy).toHaveBeenCalledWith('Syntax error in config file')
    expect(watchSpy).toHaveBeenCalledWith('Failed to rebuild. Watching for fixes...')
    expect(compileXML).not.toHaveBeenCalled()

    await watcher.close()
  })

  it('triggers script compilation when a .ts or .tsx file changes', async () => {
    let eventHandler = null

    vi.mocked(chokidar.watch).mockReturnValueOnce({
      on: vi.fn((event, handler) => {
        if (event === 'all')
          eventHandler = handler
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    const options = {
      input: './src',
      output: './dist',
      cwd: '/test/app',
      debounceDelay: 10,
    }

    const watcher = watchMode(options)
    eventHandler('change', '/test/app/src/components/button.tsx')

    await new Promise(resolve => setTimeout(resolve, 30))

    expect(compileJS).toHaveBeenCalled()
    expect(compileXML).toHaveBeenCalled()
    expect(compileStyle).not.toHaveBeenCalled()

    await watcher.close()
  })

  it('ignores addDir and unlinkDir directory events without triggering compilation', async () => {
    let eventHandler = null

    vi.mocked(chokidar.watch).mockReturnValueOnce({
      on: vi.fn((event, handler) => {
        if (event === 'all')
          eventHandler = handler
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    const options = {
      input: './src',
      output: './dist',
      debounceDelay: 10,
    }

    const watcher = watchMode(options)
    eventHandler('addDir', './src/new-folder')
    eventHandler('unlinkDir', './src/old-folder')

    await new Promise(resolve => setTimeout(resolve, 25))

    expect(compileJS).not.toHaveBeenCalled()
    expect(compileStyle).not.toHaveBeenCalled()
    expect(compileXML).not.toHaveBeenCalled()

    await watcher.close()
  })

  it('schedules pending rerun when changes occur during an in-flight compilation', async () => {
    let eventHandler = null
    let finishFirstXml = null

    vi.mocked(chokidar.watch).mockReturnValueOnce({
      on: vi.fn((event, handler) => {
        if (event === 'all')
          eventHandler = handler
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    // First compilation will pause on compileXML until resolved
    vi.mocked(compileXML).mockImplementationOnce(() => {
      return new Promise((resolve) => {
        finishFirstXml = resolve
      })
    }).mockResolvedValue(undefined)

    const options = {
      input: './src',
      output: './dist',
      debounceDelay: 10,
    }

    const watcher = watchMode(options)

    // First change triggers in-flight compilation
    eventHandler('change', './src/theme.scss')
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(compileStyle).toHaveBeenCalledTimes(1)

    // While first compilation is in progress, second change arrives
    eventHandler('change', './src/theme.scss')

    // Finish first compilation
    finishFirstXml()

    // Wait for debounce and execution of pending rerun
    await new Promise(resolve => setTimeout(resolve, 35))

    expect(compileStyle).toHaveBeenCalledTimes(2)

    await watcher.close()
  })
})
