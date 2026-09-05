import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compileStyle } from '../../lib/compilers/css.js'
import { createTempDir } from '../helpers/temp.js'

describe('css compilation pipeline', () => {
  let inDir
  let outDir

  beforeEach(() => {
    inDir = createTempDir('hamlet-css-in-')
    outDir = createTempDir('hamlet-css-out-')
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
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
    expect(unminContent).toContain('#ff5500')
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
})
