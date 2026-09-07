import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileXML } from '../../lib/compilers/xml.js'
import { logger } from '../../lib/utils/logger.js'
import { createTempDir } from '../helpers/temp.js'

describe('handlebars diagnostics integration pipeline', () => {
  let inDir
  let outDir
  let errorSpy
  let warnSpy

  beforeEach(() => {
    inDir = createTempDir('hamlet-diag-in-')
    outDir = createTempDir('hamlet-diag-out-')
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
    vi.restoreAllMocks()
  })

  it('reports exact line and column on syntax error in root template', async () => {
    const rootTemplate = `line 1
line 2
{{#if unclosed}
line 4`
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), rootTemplate)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileXML(options)).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('Parse error on line 3')
    const locStr = Array.isArray(loc) ? loc.join('\n') : loc
    expect(locStr).toMatch(/theme\.xml:3:\d+/)
  })

  it('reports exact file, line and column on syntax error in a partial', async () => {
    const brokenPartial = `partial 1
{{#if broken}
partial 3`
    fs.writeFileSync(path.join(inDir.dir, '_header.hbs'), brokenPartial)
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), '<html>{{> header}}</html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileXML(options)).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('Parse error on line 2')
    const locStr = Array.isArray(loc) ? loc.join('\n') : loc
    expect(locStr).toMatch(/_header\.hbs:2:\d+/)
  })

  it('reports exact line and column for missing partial in root template', async () => {
    const rootTemplate = `<html>
  <head></head>
  <body>
    {{> notFound}}
  </body>
</html>`
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), rootTemplate)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileXML(options)).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('The partial notFound could not be found')
    const locStr = Array.isArray(loc) ? loc.join('\n') : loc
    expect(locStr).toContain('theme.xml:4:4')
    expect(locStr).not.toContain('included from')
  })

  it('reports exact partial location and inclusion stack for missing partial in direct partial', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_header.hbs'), '<header>\n  {{> missingLogo}}\n</header>')
    const rootTemplate = `<html>
  <body>
    {{> header}}
  </body>
</html>`
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), rootTemplate)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileXML(options)).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('The partial missingLogo could not be found')

    const locArr = Array.isArray(loc) ? loc : [loc]
    expect(locArr[0]).toMatch(/_header\.hbs:2:2/)
    expect(locArr[1]).toMatch(/included from .*theme\.xml:3:4/)
  })

  it('reports nested partial error with 2 levels of inclusion', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_widget.hbs'), 'widget 1\nwidget 2\n      {{> ghostPart}}\nwidget 4')
    fs.writeFileSync(path.join(inDir.dir, '_sidebar.hbs'), '<aside>\n  {{> widget}}\n</aside>')
    const rootTemplate = `<html>
  <body>
    {{> sidebar}}
  </body>
</html>`
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), rootTemplate)

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileXML(options)).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('The partial ghostPart could not be found')

    const locArr = Array.isArray(loc) ? loc : [loc]
    expect(locArr[0]).toMatch(/_widget\.hbs:3:6/)
    expect(locArr[1]).toMatch(/included from .*_sidebar\.hbs:2:2/)
    expect(locArr[2]).toMatch(/included from .*theme\.xml:3:4/)
  })

  it('reports deep inclusion stack across 3+ levels', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_d.hbs'), 'd 1\n    {{> missingInDeep}}\nd 3')
    fs.writeFileSync(path.join(inDir.dir, '_c.hbs'), 'c 1\n  {{> d}}\nc 3')
    fs.writeFileSync(path.join(inDir.dir, '_b.hbs'), 'b 1\n   {{> c}}\nb 3')
    fs.writeFileSync(path.join(inDir.dir, '_a.hbs'), 'a 1\n    {{> b}}\na 3')
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), 'root 1\n  {{> a}}\nroot 3')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await expect(compileXML(options)).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('The partial missingInDeep could not be found')

    const locArr = Array.isArray(loc) ? loc : [loc]
    expect(locArr[0]).toMatch(/_d\.hbs:2:4/)
    expect(locArr[1]).toMatch(/included from .*_c\.hbs:2:2/)
    expect(locArr[2]).toMatch(/included from .*_b\.hbs:2:3/)
    expect(locArr[3]).toMatch(/included from .*_a\.hbs:2:4/)
    expect(locArr[4]).toMatch(/included from .*theme\.xml:2:2/)
  })

  it('reports helper runtime error inside nested partial with inclusion stack', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_child.hbs'), '<div>\n  {{explodingHelper}}\n</div>')
    fs.writeFileSync(path.join(inDir.dir, '_parent.hbs'), '<section>\n  {{> child}}\n</section>')
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), '<html>\n  {{> parent}}\n</html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
      hamlet: {
        helpers: {
          explodingHelper: () => {
            throw new TypeError('Helper detonated!')
          },
        },
      },
    }

    await expect(compileXML(options)).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('Helper detonated!')

    const locArr = Array.isArray(loc) ? loc : [loc]
    expect(locArr[0]).toMatch(/_child\.hbs:2:2/)
    expect(locArr[1]).toMatch(/included from .*_parent\.hbs:2:2/)
    expect(locArr[2]).toMatch(/included from .*theme\.xml:2:2/)
  })

  it('warns with file and inclusion stack when a helper is missing', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_header.hbs'), '<header>\n  {{missingHelper "foo"}}\n</header>')
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), '<html>\n  {{> header}}\n</html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: false,
    }

    await compileXML(options)

    expect(warnSpy).toHaveBeenCalled()
    const calls = warnSpy.mock.calls
    const missingCall = calls.find(c => c[0].includes('The helper {{missingHelper}} does not exist'))
    expect(missingCall).toBeDefined()

    const loc = missingCall[1]
    const locArr = Array.isArray(loc) ? loc : [loc]
    expect(locArr[0]).toMatch(/_header\.hbs:2:2/)
    expect(locArr[1]).toMatch(/included from .*theme\.xml:2:2/)
  })

  it('suppresses throws in watch mode and logs full diagnostic location', async () => {
    fs.writeFileSync(path.join(inDir.dir, '_header.hbs'), 'header\n{{> missingWidget}}')
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), '<html>\n  {{> header}}\n</html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      watch: true,
    }

    await expect(compileXML(options)).resolves.not.toThrow()

    expect(errorSpy).toHaveBeenCalled()
    const [msg, loc] = errorSpy.mock.calls[0]
    expect(msg).toContain('The partial missingWidget could not be found')

    const locArr = Array.isArray(loc) ? loc : [loc]
    expect(locArr[0]).toMatch(/_header\.hbs:2:0/)
    expect(locArr[1]).toMatch(/included from .*theme\.xml:2:2/)
  })
})
