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
      './src',
      expect.objectContaining({
        ignored: expect.arrayContaining(['./dist']),
        ignoreInitial: true,
      }),
    )
  })
})
