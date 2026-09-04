import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compileXML } from '../../lib/compilers/xml.js'

describe('xML compilation pipeline', () => {
  let tmpInput
  let tmpOutput

  beforeEach(() => {
    tmpInput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-in-'))
    tmpOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-out-'))
  })

  afterEach(() => {
    fs.rmSync(tmpInput, { recursive: true, force: true })
    fs.rmSync(tmpOutput, { recursive: true, force: true })
  })

  it('compiles an XML template with partials, helpers and Blogger parser', async () => {
    fs.writeFileSync(path.join(tmpInput, '_header.hbs'), '<header><b:widget type="Header"/></header>')

    const mainXml = `
      <html>
        <head>
          <title>{{concat "Hamlet" " " "Theme"}}</title>
        </head>
        <body>
          {{> header}}
        </body>
      </html>
    `
    fs.writeFileSync(path.join(tmpInput, 'theme.xml'), mainXml)

    const options = {
      input: tmpInput,
      output: tmpOutput,
      mode: 'production',
      hamlet: {
        helpers: {},
        plugins: [],
      },
    }

    await compileXML(options)

    const outputFile = path.join(tmpOutput, 'theme.xml')
    expect(fs.existsSync(outputFile)).toBe(true)

    const result = fs.readFileSync(outputFile, 'utf8')
    expect(result).toContain('b:css=\'false\'')
    expect(result).toContain('b:layoutsVersion=\'3\'')
    expect(result).toContain('<title>Hamlet Theme</title>')
    expect(result).toContain('<header>')
    expect(result).toContain('id=\'Header1\'')
  })
})
