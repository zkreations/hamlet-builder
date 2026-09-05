import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createCli } from '../../lib/cli.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'))

describe('cli command line interface', () => {
  it('configures default CLI options and values', () => {
    const cli = createCli({
      pkg: { name: 'hamlet-builder', version: '1.0.0' },
    })

    expect(cli.version()).toBe('1.0.0')

    cli.parse(['node', 'bin.js'])
    const opts = cli.opts()

    expect(opts.input).toBe('./src')
    expect(opts.output).toBe('./dist')
    expect(opts.mode).toBe('development')
  })

  it('correctly parses custom CLI options and flags', () => {
    const cli = createCli({
      pkg: { name: 'hamlet-builder', version: '1.0.0' },
    })

    cli.parse([
      'node',
      'bin.js',
      '-i',
      './custom-src',
      '-o',
      './custom-dist',
      '-m',
      'production',
      '-w',
      '-I',
      '--no-minify',
      '--no-minify-css',
      '--no-minify-js',
    ])
    const opts = cli.opts()

    expect(opts.input).toBe('./custom-src')
    expect(opts.output).toBe('./custom-dist')
    expect(opts.mode).toBe('production')
    expect(opts.watch).toBe(true)
    expect(opts.info).toBe(true)
    expect(opts.minify).toBe(false)
    expect(opts.minifyCss).toBe(false)
    expect(opts.minifyJs).toBe(false)
  })

  it('reads package.json version dynamically by default', () => {
    const cli = createCli()
    expect(cli.version()).toBe(pkgJson.version)
  })
})

