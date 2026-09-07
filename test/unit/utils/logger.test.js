import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../../lib/utils/logger.js'

describe('logger', () => {
  let warnSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('prints reload message with badge format and vertical spacing', () => {
    logger.reload('Configuration changed, reloading...')
    expect(warnSpy).toHaveBeenCalled()
    const output = warnSpy.mock.calls[0][0]
    expect(output).toContain('reload')
    expect(output).toContain('Configuration changed, reloading...')
    expect(output.startsWith('\n')).toBe(true)
    expect(output.endsWith('\n')).toBe(true)
  })

  it('prints built and ready messages with vertical spacing', () => {
    logger.built('completed in 10ms')
    const builtOutput = warnSpy.mock.calls[0][0]
    expect(builtOutput.startsWith('\n')).toBe(true)
    expect(builtOutput.endsWith('\n')).toBe(true)

    logger.ready('in 10ms')
    const readyOutput = warnSpy.mock.calls[1][0]
    expect(readyOutput.startsWith('\n')).toBe(true)
    expect(readyOutput.endsWith('\n')).toBe(true)
  })

  it('prints warning and location lines', () => {
    logger.resetWarnings()
    logger.warn('Something suspicious', 'src/file.js:10:2')
    expect(logger.getWarningCount()).toBe(1)
    expect(warnSpy).toHaveBeenCalled()
    const calls = warnSpy.mock.calls.map(c => c[0])
    expect(calls.some(c => c.includes('Something suspicious'))).toBe(true)
    expect(calls.some(c => c.includes('src/file.js:10:2'))).toBe(true)
  })

  it('prints error and multi-line array location with indentation', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.resetErrors()

    logger.error('Fatal failure', [
      'src/partials/child.hbs:7:12',
      'included from src/partials/parent.hbs:4:5',
      'included from src/templates/root.hbs:13:28',
    ])

    expect(logger.getErrorCount()).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    const calls = errorSpy.mock.calls.map(c => c[0])
    expect(calls.some(c => c.includes('Fatal failure'))).toBe(true)
    expect(calls.some(c => c.includes('src/partials/child.hbs:7:12'))).toBe(true)
    expect(calls.some(c => c.includes('included from src/partials/parent.hbs:4:5'))).toBe(true)
    expect(calls.some(c => c.includes('included from src/templates/root.hbs:13:28'))).toBe(true)

    errorSpy.mockRestore()
  })

  it('handles progress updates and clearing in TTY mode', () => {
    const originalIsTTY = process.stderr.isTTY
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    try {
      process.stderr.isTTY = true

      const p = logger.progress('inspect', 'cyan', 'initial stage')
      expect(stderrSpy).toHaveBeenCalled()
      expect(stderrSpy.mock.calls[0][0]).toContain('[inspect]')
      expect(stderrSpy.mock.calls[0][0]).toContain('initial stage')

      p.update('next stage')
      expect(stderrSpy.mock.calls[1][0]).toContain('next stage')

      p.clear()
      expect(stderrSpy.mock.calls[2][0]).toBe('\r\x1B[2K')
    }
    finally {
      process.stderr.isTTY = originalIsTTY
      stderrSpy.mockRestore()
    }
  })

  it('no-ops progress in non-TTY mode', () => {
    const originalIsTTY = process.stderr.isTTY
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    try {
      process.stderr.isTTY = false

      const p = logger.progress('inspect', 'cyan', 'should not write')
      expect(stderrSpy).not.toHaveBeenCalled()

      p.update('still nothing')
      expect(stderrSpy).not.toHaveBeenCalled()

      p.clear()
      expect(stderrSpy).not.toHaveBeenCalled()
    }
    finally {
      process.stderr.isTTY = originalIsTTY
      stderrSpy.mockRestore()
    }
  })
})
