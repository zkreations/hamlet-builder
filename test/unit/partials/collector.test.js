import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectPartials, loadPartials } from '../../../lib/partials/collector.js'
import { createTempDir } from '../../helpers/temp.js'

describe('partials collector', () => {
  let tmp

  beforeEach(() => {
    tmp = createTempDir('hamlet-partials-')
  })

  afterEach(() => {
    tmp.cleanup()
  })

  it('returns empty collections when no partials exist', async () => {
    const result = await collectPartials(tmp.dir)
    expect(result.normalPartials).toEqual([])
    expect(result.folderPartials).toEqual([])
    expect(result.duplicates).toEqual([])
    expect(result.folderDuplicates).toEqual([])
  })

  it('collects partials and creates folder partials', async () => {
    const navDir = path.join(tmp.dir, 'nav')
    fs.mkdirSync(navDir)
    fs.writeFileSync(path.join(navDir, '_menu.hbs'), '<nav>menu</nav>')
    fs.writeFileSync(path.join(navDir, '_item.hbs'), '<li>item</li>')

    const result = await collectPartials(tmp.dir)

    expect(result.normalPartials).toContain('menu')
    expect(result.normalPartials).toContain('item')
    expect(result.folderPartials).toContain('folder.nav')
    expect(result.partials['folder.nav'].template).toContain('{{> item}}')
    expect(result.partials['folder.nav'].template).toContain('{{> menu}}')

    const loaded = await loadPartials(tmp.dir)
    expect(loaded.menu).toBe('<nav>menu</nav>\n')
    expect(loaded.item).toBe('<li>item</li>\n')
    expect(loaded._partialsInfo.menu.file).toContain('_menu.hbs')
    expect(loaded._partialsInfo.item.file).toContain('_item.hbs')
  })

  it('detects duplicate partial names across different directories', async () => {
    const dirA = path.join(tmp.dir, 'components')
    const dirB = path.join(tmp.dir, 'widgets')
    fs.mkdirSync(dirA)
    fs.mkdirSync(dirB)

    fs.writeFileSync(path.join(dirA, '_button.hbs'), '<button>A</button>')
    fs.writeFileSync(path.join(dirB, '_button.hbs'), '<button>B</button>')

    const result = await collectPartials(tmp.dir)

    expect(result.duplicates).toHaveLength(1)
    const [duplicate] = result.duplicates
    expect(duplicate.name).toBe('button')

    const conflictingFiles = [duplicate.registered, ...duplicate.duplicates].map(p => path.normalize(p))
    expect(conflictingFiles).toEqual(expect.arrayContaining([
      path.normalize(path.join(dirA, '_button.hbs')),
      path.normalize(path.join(dirB, '_button.hbs')),
    ]))
  })

  it('detects duplicate folder names across nested directories', async () => {
    const path1 = path.join(tmp.dir, 'sub1', 'cards')
    const path2 = path.join(tmp.dir, 'sub2', 'cards')
    fs.mkdirSync(path1, { recursive: true })
    fs.mkdirSync(path2, { recursive: true })

    fs.writeFileSync(path.join(path1, '_cardA.hbs'), '<div>Card A</div>')
    fs.writeFileSync(path.join(path2, '_cardB.hbs'), '<div>Card B</div>')

    const result = await collectPartials(tmp.dir)

    expect(result.folderDuplicates).toHaveLength(1)
    const [folderDup] = result.folderDuplicates
    expect(folderDup.name).toBe('folder.cards')

    const conflictingFolders = [folderDup.registered, ...folderDup.duplicates].map(p => path.normalize(p))
    expect(conflictingFolders).toEqual(expect.arrayContaining([
      path.normalize(path1),
      path.normalize(path2),
    ]))
  })
})
