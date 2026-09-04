import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compileJS } from '../../lib/compilers/js.js'

describe('jS compilation pipeline', () => {
  let tmpInput
  let tmpOutput

  beforeEach(() => {
    tmpInput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-js-in-'))
    tmpOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-js-out-'))
  })

  afterEach(() => {
    fs.rmSync(tmpInput, { recursive: true, force: true })
    fs.rmSync(tmpOutput, { recursive: true, force: true })
  })

  it('bundles entry file into IIFE unminified and minified js', async () => {
    const jsContent = `
      const message = 'Hello from Hamlet';
      export function greet() {
        return message;
      }
    `
    fs.writeFileSync(path.join(tmpInput, 'app.bundle.js'), jsContent)

    const options = {
      input: tmpInput,
      output: tmpOutput,
      minify: true,
      minifyJs: true,
      rollup: {
        plugins: [],
      },
    }

    await compileJS(options)

    const unminified = path.join(tmpOutput, 'js', 'app.js')
    const minified = path.join(tmpOutput, 'js', 'app.min.js')

    expect(fs.existsSync(unminified)).toBe(true)
    expect(fs.existsSync(minified)).toBe(true)

    const unminContent = fs.readFileSync(unminified, 'utf8')
    expect(unminContent).toContain('Hello from Hamlet')

    const minContent = fs.readFileSync(minified, 'utf8')
    expect(minContent.length).toBeLessThan(unminContent.length)
  })
})
