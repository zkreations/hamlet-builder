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
})
