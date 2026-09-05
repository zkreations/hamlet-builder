import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compileXML } from '../../lib/compilers/xml.js'
import { createTempDir } from '../helpers/temp.js'

describe('xml compilation pipeline', () => {
  let inDir
  let outDir

  beforeEach(() => {
    inDir = createTempDir('hamlet-xml-in-')
    outDir = createTempDir('hamlet-xml-out-')
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
  })

  it('compiles an XML template with partials, helpers and Blogger parser', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_header.hbs'), '<header><b:widget type="Header"/></header>')

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
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), mainXml)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'production',
      hamlet: {
        helpers: {},
        plugins: [],
      },
    }

    await compileXML(options)

    const outputFile = path.join(outDir.dir, 'theme.xml')
    expect(fs.existsSync(outputFile)).toBe(true)

    const result = fs.readFileSync(outputFile, 'utf8')
    expect(result).toContain('b:css=\'false\'')
    expect(result).toContain('b:layoutsVersion=\'3\'')
    expect(result).toContain('<title>Hamlet Theme</title>')
    expect(result).toContain('<header>')
    expect(result).toContain('id=\'Header1\'')
  })

  it('does not generate output for partial files starting with underscore', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_partial.hbs'), '<div>partial</div>')
    fs.writeFileSync(path.join(inDir.dir, 'index.xml'), '<html><body>{{> partial}}</body></html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'production',
      hamlet: { helpers: {}, plugins: [] },
    }

    await compileXML(options)

    expect(fs.existsSync(path.join(outDir.dir, '_partial.xml'))).toBe(false)
    expect(fs.existsSync(path.join(outDir.dir, 'index.xml'))).toBe(true)
  })

  it('injects theme data and development mode flag into template context', async () => {
    const mainXml = `
      <html>
        <head>
          <title>{{themeName}}</title>
          {{#if development}}<meta name="env" content="dev"/>{{/if}}
        </head>
        <body></body>
      </html>
    `
    fs.writeFileSync(path.join(inDir.dir, 'dev.xml'), mainXml)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'development',
      theme: { themeName: 'Custom Hamlet' },
      hamlet: { helpers: {}, plugins: [] },
    }

    await compileXML(options)

    const result = fs.readFileSync(path.join(outDir.dir, 'dev.xml'), 'utf8')
    expect(result).toContain('<title>Custom Hamlet</title>')
    expect(result).toContain('<meta name="env" content="dev"/>')
  })

  it('returns early when input contains no template files', async () => {
    const options = {
      input: inDir.dir,
      output: outDir.dir,
    }

    await expect(compileXML(options)).resolves.not.toThrow()
  })

  it('throws error in build mode on invalid template syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'broken.xml'), '<html>{{#unclosed}}</html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileXML(options)).rejects.toThrow()
  })

  it('suppresses error in watch mode on invalid template syntax', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'broken.xml'), '<html>{{#unclosed}}</html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: true,
    }

    await expect(compileXML(options)).resolves.not.toThrow()
  })
})
