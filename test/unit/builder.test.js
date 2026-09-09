import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { build } from '../../lib/builder.js'
import { compileStyle } from '../../lib/compilers/css.js'
import { compileJS } from '../../lib/compilers/js.js'
import { compileXML } from '../../lib/compilers/xml.js'

vi.mock('../../lib/compilers/css.js', () => ({
  compileStyle: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/compilers/js.js', () => ({
  compileJS: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/compilers/xml.js', () => ({
  compileXML: vi.fn().mockResolvedValue(undefined),
}))

describe('builder orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('orchestrates compilation of scripts and styles in parallel before compiling XML', async () => {
    const callOrder = []

    vi.mocked(compileJS).mockImplementation(async () => {
      callOrder.push('js')
    })
    vi.mocked(compileStyle).mockImplementation(async () => {
      callOrder.push('style')
    })
    vi.mocked(compileXML).mockImplementation(async () => {
      callOrder.push('xml')
    })

    const options = {
      input: '/test/src',
      output: '/test/dist',
      mode: 'production',
    }

    await build(options)

    expect(compileJS).toHaveBeenCalledWith(options)
    expect(compileStyle).toHaveBeenCalledWith(options)
    expect(compileXML).toHaveBeenCalledWith(options)
    expect(callOrder.indexOf('xml')).toBeGreaterThan(callOrder.indexOf('js'))
    expect(callOrder.indexOf('xml')).toBeGreaterThan(callOrder.indexOf('style'))
  })

  it('fails build when a script or style compiler fails and prevents XML compilation', async () => {
    vi.mocked(compileStyle).mockRejectedValueOnce(new Error('Style compilation error'))

    const options = { input: '/test/src', output: '/test/dist' }

    await expect(build(options)).rejects.toThrow('Style compilation error')
    expect(compileXML).not.toHaveBeenCalled()
  })

  it('fails build when XML compiler fails', async () => {
    vi.mocked(compileXML).mockRejectedValueOnce(new Error('XML compilation error'))

    const options = { input: '/test/src', output: '/test/dist' }

    await expect(build(options)).rejects.toThrow('XML compilation error')
  })
})
