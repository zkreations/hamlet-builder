import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileJS } from '../../lib/compilers/js.js'
import { createTempDir } from '../helpers/temp.js'

describe('js compilation pipeline', () => {
  let inDir
  let outDir

  beforeEach(() => {
    inDir = createTempDir('hamlet-js-in-')
    outDir = createTempDir('hamlet-js-out-')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
    vi.restoreAllMocks()
  })

  it('bundles entry file into IIFE unminified and minified js', async () => {
    const jsContent = `
      const message = 'Hello from Hamlet';
      export function greet() {
        return message;
      }
    `
    fs.writeFileSync(path.join(inDir.dir, 'app.bundle.js'), jsContent)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: true,
      minifyJs: true,
      rollup: { plugins: [] },
    }

    await compileJS(options)

    const unminified = path.join(outDir.dir, 'js', 'app.js')
    const minified = path.join(outDir.dir, 'js', 'app.min.js')

    expect(fs.existsSync(unminified)).toBe(true)
    expect(fs.existsSync(minified)).toBe(true)

    const unminContent = fs.readFileSync(unminified, 'utf8')
    expect(unminContent).toContain('Hello from Hamlet')

    const minContent = fs.readFileSync(minified, 'utf8')
    expect(minContent.length).toBeLessThan(unminContent.length)
  })

  it('ignores files that do not match the *.bundle.@(js|mjs|cjs) pattern', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'helper.js'), 'export const x = 1;')
    fs.writeFileSync(path.join(inDir.dir, 'main.bundle.js'), 'import { x } from "./helper.js"; console.log(x);')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: false,
      minifyJs: false,
    }

    await compileJS(options)

    expect(fs.existsSync(path.join(outDir.dir, 'js', 'helper.js'))).toBe(false)
    expect(fs.existsSync(path.join(outDir.dir, 'js', 'main.js'))).toBe(true)
  })

  it('respects minifyJs false and produces only unminified bundle', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'script.bundle.js'), 'console.log("unminified only");')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      minify: true,
      minifyJs: false,
    }

    await compileJS(options)

    expect(fs.existsSync(path.join(outDir.dir, 'js', 'script.js'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'js', 'script.min.js'))).toBe(false)
  })

  it('returns early when input contains no bundle files', async () => {
    const options = {
      input: inDir.dir,
      output: outDir.dir,
    }

    await expect(compileJS(options)).resolves.not.toThrow()
    expect(fs.existsSync(path.join(outDir.dir, 'js'))).toBe(false)
  })

  it('throws error in build mode on invalid JS syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'broken.bundle.js'), 'const broken = ;')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileJS(options)).rejects.toThrow()
  })

  it('suppresses error in watch mode on invalid JS syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'broken.bundle.js'), 'const broken = ;')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: true,
    }

    await expect(compileJS(options)).resolves.not.toThrow()
  })
})
