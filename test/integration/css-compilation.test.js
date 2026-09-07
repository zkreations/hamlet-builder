import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileStyle } from '../../lib/compilers/css.js'
import { createTempDir } from '../helpers/temp.js'

describe('css compilation pipeline', () => {
  let inDir
  let outDir

  beforeEach(() => {
    inDir = createTempDir('hamlet-css-in-')
    outDir = createTempDir('hamlet-css-out-')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
    vi.restoreAllMocks()
  })

  it('compiles scss into unminified and minified css', async () => {
    const scssContent = `
      $primary: #ff5500;
      .header {
        color: $primary;
        display: flex;
      }
    `
    fs.writeFileSync(path.join(inDir.dir, 'style.scss'), scssContent)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: true,
      minifyCss: true,
      postcss: { plugins: [] },
    }

    await compileStyle(options)

    const unminified = path.join(outDir.dir, 'css', 'style.css')
    const minified = path.join(outDir.dir, 'css', 'style.min.css')

    expect(fs.existsSync(unminified)).toBe(true)
    expect(fs.existsSync(minified)).toBe(true)

    const unminContent = fs.readFileSync(unminified, 'utf8')
    expect(unminContent).toMatch(/#f50|#ff5500/)
    expect(unminContent).toContain('.header')

    const minContent = fs.readFileSync(minified, 'utf8')
    expect(minContent).toContain('.header')
    expect(minContent.length).toBeLessThan(unminContent.length)
  })

  it('compiles plain css files and respects minifyCss false', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'plain.css'), '.plain { margin: 0; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: true,
      minifyCss: false,
      postcss: { plugins: [] },
    }

    await compileStyle(options)

    const unminified = path.join(outDir.dir, 'css', 'plain.css')
    const minified = path.join(outDir.dir, 'css', 'plain.min.css')

    expect(fs.existsSync(unminified)).toBe(true)
    expect(fs.existsSync(minified)).toBe(false)
    expect(fs.readFileSync(unminified, 'utf8')).toContain('.plain')
  })

  it('ignores partial style files starting with underscore', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_variables.scss'), '$bg: #000;')
    fs.writeFileSync(path.join(inDir.dir, 'main.scss'), '@use "variables" as v; body { background: v.$bg; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: false,
      minifyCss: false,
    }

    await compileStyle(options)

    expect(fs.existsSync(path.join(outDir.dir, 'css', '_variables.css'))).toBe(false)
    expect(fs.existsSync(path.join(outDir.dir, 'css', 'main.css'))).toBe(true)
  })

  it('returns early when input contains no style files', async () => {
    const options = {
      input: inDir.dir,
      output: outDir.dir,
    }

    await expect(compileStyle(options)).resolves.not.toThrow()
    expect(fs.existsSync(path.join(outDir.dir, 'css'))).toBe(false)
  })

  it('throws error in build mode on invalid scss syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'invalid.scss'), '.broken { color: ; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileStyle(options)).rejects.toThrow()
  })

  it('suppresses error in watch mode on invalid scss syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'invalid.scss'), '.broken { color: ; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: true,
    }

    await expect(compileStyle(options)).resolves.not.toThrow()
  })

  it('generates source map file when sourcemap is enabled', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'dev.scss'), '.dev { display: flex; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'development',
      sourcemap: true,
    }

    await compileStyle(options)

    const cssFile = path.join(outDir.dir, 'css', 'dev.css')
    const mapFile = path.join(outDir.dir, 'css', 'dev.css.map')

    expect(fs.existsSync(cssFile)).toBe(true)
    expect(fs.existsSync(mapFile)).toBe(true)

    const cssContent = fs.readFileSync(cssFile, 'utf8')
    expect(cssContent).toContain('/*# sourceMappingURL=dev.css.map */')

    const mapContent = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
    expect(mapContent.version).toBe(3)
    expect(mapContent.sources.length).toBeGreaterThan(0)
  })

  it('does not generate source map in production mode', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'prod.scss'), '.prod { display: flex; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'production',
    }

    await compileStyle(options)

    const cssFile = path.join(outDir.dir, 'css', 'prod.css')
    const mapFile = path.join(outDir.dir, 'css', 'prod.css.map')

    expect(fs.existsSync(cssFile)).toBe(true)
    expect(fs.existsSync(mapFile)).toBe(false)
  })

  it('does not generate source map by default in development mode', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'nodevmap.scss'), '.nodev { display: flex; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'development',
    }

    await compileStyle(options)

    const cssFile = path.join(outDir.dir, 'css', 'nodevmap.css')
    const mapFile = path.join(outDir.dir, 'css', 'nodevmap.css.map')

    expect(fs.existsSync(cssFile)).toBe(true)
    expect(fs.existsSync(mapFile)).toBe(false)

    const cssContent = fs.readFileSync(cssFile, 'utf8')
    expect(cssContent).not.toContain('sourceMappingURL')
  })

  it('generates source map when enabled via hamlet config option', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'hamletmap.scss'), '.hamletmap { display: flex; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'development',
      hamlet: {
        sourcemap: true,
      },
    }

    await compileStyle(options)

    const cssFile = path.join(outDir.dir, 'css', 'hamletmap.css')
    const mapFile = path.join(outDir.dir, 'css', 'hamletmap.css.map')

    expect(fs.existsSync(cssFile)).toBe(true)
    expect(fs.existsSync(mapFile)).toBe(true)
    expect(fs.readFileSync(cssFile, 'utf8')).toContain('/*# sourceMappingURL=hamletmap.css.map */')
  })

  it('applies vendor prefixes according to browserslist targets', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'prefix.css'), '.box { user-select: none; }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      browserslist: ['ie 11', 'chrome 80'],
    }

    await compileStyle(options)

    const cssFile = path.join(outDir.dir, 'css', 'prefix.css')
    const cssContent = fs.readFileSync(cssFile, 'utf8')

    expect(cssContent).toContain('-ms-user-select: none')
    expect(cssContent).toContain('user-select: none')
  })

  it('transpiles CSS nesting properly according to browserslist targets', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'nesting.css'), '.parent { color: red; & .child { color: blue; } }')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      browserslist: ['ie 11'],
    }

    await compileStyle(options)

    const cssFile = path.join(outDir.dir, 'css', 'nesting.css')
    const cssContent = fs.readFileSync(cssFile, 'utf8')

    // IE11 target should un-nest the rule into .parent .child
    expect(cssContent).toContain('.parent .child')
  })
})
