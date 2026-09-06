import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { build } from '../../lib/builder.js'
import { createTempDir } from '../helpers/temp.js'

describe('builder orchestrator', () => {
  let inDir
  let outDir

  beforeEach(() => {
    inDir = createTempDir('hamlet-builder-in-')
    outDir = createTempDir('hamlet-builder-out-')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
    vi.restoreAllMocks()
  })

  it('orchestrates compilation of styles, scripts, and XML', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'main.scss'), 'a { text-decoration: none; }')
    fs.writeFileSync(path.join(inDir.dir, 'index.bundle.js'), 'console.log("builder test");')
    fs.writeFileSync(path.join(inDir.dir, 'index.xml'), '<html><body>Hello</body></html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'production',
      minify: false,
      minifyCss: false,
      minifyJs: false,
      postcss: { plugins: [] },
      rollup: { plugins: [] },
      hamlet: { helpers: {}, plugins: [] },
    }

    await build(options)

    expect(fs.existsSync(path.join(outDir.dir, 'css', 'main.css'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'js', 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'index.xml'))).toBe(true)
  })

  it('fails build when a compiler fails in non-watch mode', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'broken.scss'), '.broken { color: ; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(build(options)).rejects.toThrow()
  })
})
