import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as printer from '../../../lib/formatters/info-printer.js'
import { infoMode } from '../../../lib/modes/info.js'
import { logger } from '../../../lib/utils/logger.js'
import { createTempDir } from '../../helpers/temp.js'

describe('infoMode', () => {
  let tmp
  let warnSpy
  let readySpy
  let progressSpy

  beforeEach(() => {
    tmp = createTempDir('hamlet-info-mode-')
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    readySpy = vi.spyOn(logger, 'ready').mockImplementation(() => {})
    progressSpy = vi.spyOn(logger, 'progress').mockReturnValue({
      update: vi.fn(),
      clear: vi.fn(),
    })
  })

  afterEach(() => {
    tmp.cleanup()
    warnSpy.mockRestore()
    readySpy.mockRestore()
    progressSpy.mockRestore()
  })

  it('runs complete inspect mode, reports progress and finishes with ready badge', async () => {
    await infoMode({
      input: tmp.dir,
      output: path.join(tmp.dir, 'dist'),
      mode: 'development',
      cwd: tmp.dir,
    })

    expect(progressSpy).toHaveBeenCalledWith('inspect', 'cyan', 'analyzing partials...')
    const progressInstance = progressSpy.mock.results[0].value
    expect(progressInstance.clear).toHaveBeenCalled()

    expect(readySpy).toHaveBeenCalled()
    expect(readySpy.mock.calls[0][0]).toContain('inspect completed in')
  })

  it('cleans up progress even if printPartialsInfo fails', async () => {
    vi.spyOn(printer, 'printPartialsInfo').mockRejectedValueOnce(new Error('Inspection failed'))

    await expect(infoMode({
      input: tmp.dir,
      output: path.join(tmp.dir, 'dist'),
      mode: 'development',
      cwd: tmp.dir,
    })).rejects.toThrow('Inspection failed')

    const progressInstance = progressSpy.mock.results[0].value
    expect(progressInstance.clear).toHaveBeenCalled()
  })
})
