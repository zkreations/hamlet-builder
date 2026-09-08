import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { build } from '../../lib/builder.js'
import { createCli, runCli } from '../../lib/cli.js'
import { loadConfigurations } from '../../lib/config.js'
import { buildMode } from '../../lib/modes/build.js'
import { infoMode } from '../../lib/modes/info.js'
import { watchMode } from '../../lib/modes/watch.js'
import { logger } from '../../lib/utils/logger.js'
import { createTempDir } from '../helpers/temp.js'

vi.mock('../../lib/config.js', () => ({
  loadConfigurations: vi.fn().mockResolvedValue({
    postcss: { plugins: [] },
    rollup: { plugins: [] },
    hamlet: { helpers: {} },
    theme: {},
  }),
}))

vi.mock('../../lib/modes/build.js', () => ({
  buildMode: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/modes/info.js', () => ({
  infoMode: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/modes/watch.js', () => ({
  watchMode: vi.fn(),
}))

vi.mock('../../lib/builder.js', () => ({
  build: vi.fn().mockResolvedValue(undefined),
}))

describe('cli command line interface', () => {
  let tmp
  let exitSpy
  let loggerErrorSpy
  let loggerHamletSpy

  beforeEach(() => {
    tmp = createTempDir('hamlet-cli-')
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`)
    })
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    loggerHamletSpy = vi.spyOn(logger, 'hamlet').mockImplementation(() => {})
    vi.spyOn(logger, 'ready').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    tmp.cleanup()
    vi.restoreAllMocks()
  })

  it('reads package version dynamically and configures defaults', () => {
    const cli = createCli({
      pkg: { name: 'hamlet-builder', version: '2.5.0' },
    })
    expect(cli.version()).toBe('2.5.0')
  })

  it('dispatches to buildMode with resolved paths and options when input directory exists', async () => {
    const srcDir = path.join(tmp.dir, 'src')
    fs.mkdirSync(srcDir)

    const cli = createCli({
      cwd: tmp.dir,
      pkg: { name: 'hamlet-builder', version: '1.0.0' },
    })

    await cli.parseAsync(['node', 'bin.js', '-i', './src', '-o', './dist', '-m', 'production'])

    expect(loadConfigurations).toHaveBeenCalledWith(expect.objectContaining({
      paths: {
        root: tmp.dir,
        src: srcDir,
        dist: path.join(tmp.dir, 'dist'),
      },
    }))

    expect(loggerHamletSpy).toHaveBeenCalledWith('1.0.0', 'production')
    expect(buildMode).toHaveBeenCalledWith(expect.objectContaining({
      cwd: tmp.dir,
      input: srcDir,
      output: path.join(tmp.dir, 'dist'),
      mode: 'production',
    }))
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('routes to infoMode when --inspect or -I is passed', async () => {
    const cli = createCli({
      cwd: tmp.dir,
      pkg: { name: 'hamlet-builder', version: '1.0.0' },
    })

    await cli.parseAsync(['node', 'bin.js', '--inspect'])

    expect(loggerHamletSpy).toHaveBeenCalledWith('1.0.0', 'inspect')
    expect(infoMode).toHaveBeenCalled()
    expect(buildMode).not.toHaveBeenCalled()
  })

  it('logs error and exits with code 1 when input directory does not exist', async () => {
    const cli = createCli({
      cwd: tmp.dir,
      pkg: { name: 'hamlet-builder', version: '1.0.0' },
    })

    await expect(
      cli.parseAsync(['node', 'bin.js', '-i', './nonexistent']),
    ).rejects.toThrow('process.exit(1)')

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Input directory not found'))
    expect(buildMode).not.toHaveBeenCalled()
  })

  it('builds initial assets and initializes watchMode when -w / --watch flag is set', async () => {
    const srcDir = path.join(tmp.dir, 'src')
    fs.mkdirSync(srcDir)

    const cli = createCli({
      cwd: tmp.dir,
      pkg: { name: 'hamlet-builder', version: '1.0.0' },
    })

    await cli.parseAsync(['node', 'bin.js', '-i', './src', '-w'])

    expect(build).toHaveBeenCalled()
    expect(watchMode).toHaveBeenCalled()
    expect(buildMode).not.toHaveBeenCalled()
  })

  it('runCli handles unexpected unlogged execution failures and exits', async () => {
    vi.mocked(loadConfigurations).mockRejectedValueOnce(new Error('Fatal CLI crash'))

    await expect(
      runCli(['node', 'bin.js']),
    ).rejects.toThrow('process.exit(1)')

    expect(loggerErrorSpy).toHaveBeenCalledWith('Execution failed: Fatal CLI crash')
  })
})
