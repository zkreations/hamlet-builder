import { describe, expect, it } from 'vitest'
import { createCli } from '../../lib/cli.js'

describe('cLI Command line interface', () => {
  it('creates commander instance with correct defaults', () => {
    const cli = createCli({
      pkg: { name: 'hamlet-builder', version: '1.8.0' },
    })

    expect(cli.name()).toBe('')
    expect(cli.version()).toBe('1.8.0')

    const options = cli.options.map(opt => opt.long)
    expect(options).toContain('--input')
    expect(options).toContain('--output')
    expect(options).toContain('--mode')
    expect(options).toContain('--watch')
    expect(options).toContain('--info')
    expect(options).toContain('--no-minify')
    expect(options).toContain('--no-minify-css')
    expect(options).toContain('--no-minify-js')
  })

  it('correctly parses CLI options', () => {
    const cli = createCli({
      pkg: { name: 'hamlet-builder', version: '1.8.0' },
    })

    cli.parse(['node', 'bin.js', '-i', './custom-src', '-o', './custom-dist', '-m', 'production', '--no-minify-css'])
    const opts = cli.opts()

    expect(opts.input).toBe('./custom-src')
    expect(opts.output).toBe('./custom-dist')
    expect(opts.mode).toBe('production')
    expect(opts.minifyCss).toBe(false)
  })
})
