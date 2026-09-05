import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildMode } from '../../lib/modes/build.js'
import { createTempDir } from '../helpers/temp.js'

describe('end-to-end buildMode', () => {
  let inDir
  let outDir

  beforeEach(() => {
    inDir = createTempDir('hamlet-e2e-in-')
    outDir = createTempDir('hamlet-e2e-out-')
  })

  afterEach(() => {
    inDir.cleanup()
    outDir.cleanup()
  })

  it('runs complete build: styles, scripts, and XML template', async () => {
    fs.writeFileSync(path.join(inDir.dir, 'theme.scss'), 'body { margin: 0; }')
    fs.writeFileSync(path.join(inDir.dir, 'theme.bundle.js'), 'console.log("init");')
    fs.writeFileSync(path.join(inDir.dir, '_nav.hbs'), '<nav><b:widget/></nav>')
    fs.writeFileSync(path.join(inDir.dir, 'theme.xml'), '<html><body>{{> nav}}</body></html>')

    const options = {
      input: inDir.dir,
      output: outDir.dir,
      mode: 'production',
      minify: true,
      minifyCss: true,
      minifyJs: true,
      postcss: { plugins: [] },
      rollup: { plugins: [] },
      hamlet: { helpers: {}, plugins: [] },
    }

    await buildMode(options)

    expect(fs.existsSync(path.join(outDir.dir, 'css', 'theme.css'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'css', 'theme.min.css'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'js', 'theme.js'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'js', 'theme.min.js'))).toBe(true)
    expect(fs.existsSync(path.join(outDir.dir, 'theme.xml'))).toBe(true)

    const xmlOutput = fs.readFileSync(path.join(outDir.dir, 'theme.xml'), 'utf8')
    expect(xmlOutput).toContain('<nav>')
    expect(xmlOutput).toContain('id=\'HTML1\'')
  })
})
