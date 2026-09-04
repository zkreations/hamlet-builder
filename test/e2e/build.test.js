import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildMode } from '../../lib/modes/build.js'

describe('end-to-end buildMode', () => {
  let tmpInput
  let tmpOutput

  beforeEach(() => {
    tmpInput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-e2e-in-'))
    tmpOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-e2e-out-'))
  })

  afterEach(() => {
    fs.rmSync(tmpInput, { recursive: true, force: true })
    fs.rmSync(tmpOutput, { recursive: true, force: true })
  })

  it('runs complete build: styles, scripts, and XML template', async () => {
    fs.writeFileSync(path.join(tmpInput, 'theme.scss'), 'body { margin: 0; }')
    fs.writeFileSync(path.join(tmpInput, 'theme.bundle.js'), 'console.log("init");')
    fs.writeFileSync(path.join(tmpInput, '_nav.hbs'), '<nav><b:widget/></nav>')
    fs.writeFileSync(path.join(tmpInput, 'theme.xml'), '<html><body>{{> nav}}</body></html>')

    const options = {
      input: tmpInput,
      output: tmpOutput,
      mode: 'production',
      minify: true,
      minifyCss: true,
      minifyJs: true,
      postcss: { plugins: [] },
      rollup: { plugins: [] },
      hamlet: { helpers: {}, plugins: [] },
    }

    await buildMode(options)

    expect(fs.existsSync(path.join(tmpOutput, 'css', 'theme.css'))).toBe(true)
    expect(fs.existsSync(path.join(tmpOutput, 'css', 'theme.min.css'))).toBe(true)
    expect(fs.existsSync(path.join(tmpOutput, 'js', 'theme.js'))).toBe(true)
    expect(fs.existsSync(path.join(tmpOutput, 'js', 'theme.min.js'))).toBe(true)
    expect(fs.existsSync(path.join(tmpOutput, 'theme.xml'))).toBe(true)

    const xmlOutput = fs.readFileSync(path.join(tmpOutput, 'theme.xml'), 'utf8')
    expect(xmlOutput).toContain('<nav>')
    expect(xmlOutput).toContain('id=\'HTML1\'')
  })
})
