import chokidar from 'chokidar'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchMode } from '../../lib/modes/watch.js'

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(),
      close: vi.fn(),
    })),
  },
}))

describe('watchMode configuration', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

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
    const [targets] = vi.mocked(chokidar.watch).mock.calls[1]

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
    const [, config] = vi.mocked(chokidar.watch).mock.calls[2]
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
})
