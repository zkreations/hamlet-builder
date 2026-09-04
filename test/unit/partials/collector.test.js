import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectPartials, loadPartials } from '../../../lib/partials/collector.js'

describe('partials collector', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamlet-partials-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty collections when no partials exist', async () => {
    const result = await collectPartials(tmpDir)
    expect(result.normalPartials).toEqual([])
    expect(result.folderPartials).toEqual([])
    expect(result.duplicates).toEqual([])
  })

  it('collects partials and creates folder partials', async () => {
    const navDir = path.join(tmpDir, 'nav')
    fs.mkdirSync(navDir)
    fs.writeFileSync(path.join(navDir, '_menu.hbs'), '<nav>menu</nav>')
    fs.writeFileSync(path.join(navDir, '_item.hbs'), '<li>item</li>')

    const result = await collectPartials(tmpDir)

    expect(result.normalPartials).toContain('menu')
    expect(result.normalPartials).toContain('item')
    expect(result.folderPartials).toContain('folder.nav')
    expect(result.partials['folder.nav'].template).toContain('{{> item}}')
    expect(result.partials['folder.nav'].template).toContain('{{> menu}}')

    const loaded = await loadPartials(tmpDir)
    expect(loaded.menu).toBe('<nav>menu</nav>\n')
    expect(loaded.item).toBe('<li>item</li>\n')
  })

  it('extracts skin variables and generates hamlet.skinVars', async () => {
    const skinDir = path.join(tmpDir, 'skin')
    fs.mkdirSync(skinDir)
    const skinContent = `
      <Group description="Theme Colors">
        <Variable name="body.bg" type="background" value="#fff"/>
        <Variable name="text.color" type="color" value="#333"/>
      </Group>
    `
    fs.writeFileSync(path.join(skinDir, '_skin.xml'), skinContent)

    const result = await collectPartials(tmpDir)
    expect(result.partials['hamlet.skinVars']).toBeDefined()
    expect(result.partials['hamlet.skinVars'].template).toContain('--body-bg: $(body.bg);')
    expect(result.partials['hamlet.skinVars'].template).toContain('--text-color: $(text.color);')
  })
})
