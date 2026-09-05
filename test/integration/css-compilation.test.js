import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compileStyle } from '../../lib/compilers/css.js'

describe('cSS compilation pipeline', () => {
  let tmpInput
  let tmpOutput

  beforeEach(() => {
    tmpInput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-css-in-'))
    tmpOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-css-out-'))
  })

  afterEach(() => {
    fs.rmSync(tmpInput, { recursive: true, force: true })
    fs.rmSync(tmpOutput, { recursive: true, force: true })
  })

  it('compiles scss into unminified and minified css', async () => {
    const scssContent = `
      $primary: #ff5500;
      .header {
        color: $primary;
        display: flex;
      }
    `
    fs.writeFileSync(path.join(tmpInput, 'style.scss'), scssContent)

    const options = {
      input: tmpInput,
      output: tmpOutput,
      minify: true,
      minifyCss: true,
      postcss: {
        plugins: [],
      },
    }

    await compileStyle(options)

    const unminified = path.join(tmpOutput, 'css', 'style.css')
    const minified = path.join(tmpOutput, 'css', 'style.min.css')

    expect(fs.existsSync(unminified)).toBe(true)
    expect(fs.existsSync(minified)).toBe(true)

    const unminContent = fs.readFileSync(unminified, 'utf8')
    expect(unminContent).toContain('#ff5500')
    expect(unminContent).toContain('.header')

    const minContent = fs.readFileSync(minified, 'utf8')
    expect(minContent).toContain('.header')
    expect(minContent.length).toBeLessThan(unminContent.length)
  })

  it('throws error in build mode on invalid scss syntax', async () => {
    fs.writeFileSync(path.join(tmpInput, 'invalid.scss'), '.broken { color: ; }')

    const options = {
      input: tmpInput,
      output: tmpOutput,
      watch: false,
    }

    await expect(compileStyle(options)).rejects.toThrow()
  })

  it('suppresses error in watch mode on invalid scss syntax', async () => {
    fs.writeFileSync(path.join(tmpInput, 'invalid.scss'), '.broken { color: ; }')

    const options = {
      input: tmpInput,
      output: tmpOutput,
      watch: true,
    }

    await expect(compileStyle(options)).resolves.not.toThrow()
  })
})
