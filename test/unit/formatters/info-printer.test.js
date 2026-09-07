import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { printPartialsInfo } from '../../../lib/formatters/info-printer.js'
import { createTempDir } from '../../helpers/temp.js'

describe('info-printer formatter', () => {
  let tmp
  let warnSpy

  beforeEach(() => {
    tmp = createTempDir('hamlet-info-printer-')
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    tmp.cleanup()
    warnSpy.mockRestore()
  })

  it('prints clean project state when no user partials exist', async () => {
    await printPartialsInfo({
      input: tmp.dir,
      output: path.join(tmp.dir, 'dist'),
      mode: 'development',
      cwd: tmp.dir,
    })

    expect(warnSpy).toHaveBeenCalled()
    const output = warnSpy.mock.calls.map(c => c[0]).join('\n')

    expect(output).toContain('[config]')
    expect(output).toContain('input:                ./')
    expect(output).toContain('mode:                 development')
    expect(output).toContain('minify:               css, js')
    expect(output).toContain('[partials]')
    expect(output).toContain('hamlet (14 built-in)')
    expect(output).toContain('syntax: {{> hamlet.<name>}}')
    expect(output).toContain('ads, adsense, attr, avatar')
    expect(output).toContain('normal:  none')
    expect(output).toContain('folders: none')
    expect(output).toContain('plugins: none')
    expect(output).toContain('[helpers]')
    expect(output).toContain('21 built-in · 0 custom')
    expect(output).toContain('[diagnostics]')
    expect(output).toContain('no conflicts or issues detected')
    expect(output).toContain('[summary]')
    expect(output).toContain('Partials: 14 total (14 built-in · 0 project · 0 folders · 0 plugins)')
  })

  it('prints rich inspection details for complex project with partials, plugins, and diagnostics', async () => {
    const navDir = path.join(tmp.dir, 'nav')
    const compDir = path.join(tmp.dir, 'components')
    const dupDir = path.join(tmp.dir, 'other')
    fs.mkdirSync(navDir)
    fs.mkdirSync(compDir)
    fs.mkdirSync(dupDir)

    fs.writeFileSync(path.join(navDir, '_menu.hbs'), '<nav>menu</nav>')
    fs.writeFileSync(path.join(navDir, '_item.hbs'), '<li>item</li>')
    fs.writeFileSync(path.join(compDir, '_card.hbs'), '<div class="card">card</div>')
    // Duplicate name collision
    fs.writeFileSync(path.join(dupDir, '_menu.hbs'), '<nav>duplicate</nav>')

    // Template that references menu, item, and hamlet built-ins
    fs.writeFileSync(path.join(tmp.dir, 'theme.xml'), '<html><body>{{> menu}}{{> item}}{{> hamlet.image}}{{> hamlet.snippet}}</body></html>')

    await printPartialsInfo({
      input: tmp.dir,
      output: path.join(tmp.dir, 'dist'),
      mode: 'production',
      cwd: tmp.dir,
      minifyCss: true,
      minifyJs: false,
      hamlet: {
        helpers: {
          myHelper: () => 'custom',
        },
        plugins: [
          {
            namespace: 'seo',
            partials: {
              meta: '<meta/>',
              schema: '<schema/>',
            },
          },
        ],
      },
    })

    const output = warnSpy.mock.calls.map(c => c[0]).join('\n')

    // Config
    expect(output).toContain('minify:               css')

    // Hamlet built-ins in use
    expect(output).toContain('in use (2):     image, snippet')
    expect(output).toContain('available (12):')

    // Normal partials grouped by folder
    expect(output).toContain('[partials] project (3)')
    expect(output).toContain('syntax: {{> <name>}}')
    expect(output).toContain('nav/')
    expect(output).toContain('menu')
    expect(output).toContain('_menu.hbs')
    expect(output).toContain('components/')
    expect(output).toContain('card')
    expect(output).toContain('unused')
    expect(output).toContain('_card.hbs')

    // Folders
    expect(output).toContain('[partials] folders (3)')
    expect(output).toContain('syntax: {{> folder.<name>}}')
    expect(output).toContain('nav (2 partials')

    // Plugins grouped by namespace
    expect(output).toContain('[partials] plugins (2)')
    expect(output).toContain('seo (2)')
    expect(output).toContain('syntax: {{> seo.<name>}}')
    expect(output).toContain('meta')
    expect(output).toContain('schema')

    // Helpers
    expect(output).toContain('21 built-in · 1 custom')

    // Diagnostics
    expect(output).toContain('[diagnostics]')
    expect(output).toContain('warn: 1 name collision detected')
    expect(output).toContain('menu')
    expect(output).toContain('registered: other/_menu.hbs')
    expect(output).toContain('duplicate:  nav/_menu.hbs')
    expect(output).toContain('note: 6 unused partials')
    expect(output).toContain('card')
    expect(output).toContain('components')
    expect(output).toContain('seo.meta')
    expect(output).toContain('seo.schema')

    // Summary
    expect(output).toContain('[summary]')
    expect(output).toContain('Conflicts: 1')
  })
})
