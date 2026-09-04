import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { build } from '../../lib/builder.js'

describe('builder orchestrator', () => {
  let tmpInput
  let tmpOutput

  beforeEach(() => {
    tmpInput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-builder-in-'))
    tmpOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-builder-out-'))
  })

  afterEach(() => {
    fs.rmSync(tmpInput, { recursive: true, force: true })
    fs.rmSync(tmpOutput, { recursive: true, force: true })
  })

  it('orchestrates compilation of styles, scripts, and XML', async () => {
    fs.writeFileSync(path.join(tmpInput, 'main.scss'), 'a { text-decoration: none; }')
    fs.writeFileSync(path.join(tmpInput, 'index.bundle.js'), 'console.log("builder test");')
    fs.writeFileSync(path.join(tmpInput, 'index.xml'), '<html><body>Hello</body></html>')

    const options = {
      input: tmpInput,
      output: tmpOutput,
      mode: 'production',
      minify: false,
      minifyCss: false,
      minifyJs: false,
      postcss: { plugins: [] },
      rollup: { plugins: [] },
      hamlet: { helpers: {}, plugins: [] },
    }

    await build(options)

    expect(fs.existsSync(path.join(tmpOutput, 'css', 'main.css'))).toBe(true)
    expect(fs.existsSync(path.join(tmpOutput, 'js', 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(tmpOutput, 'index.xml'))).toBe(true)
  })
})
