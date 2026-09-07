import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  analyzePartials,
  extractReferences,
  findUnusedPartials,
  propagateReferences,
} from '../../../lib/partials/analyzer.js'
import { createTempDir } from '../../helpers/temp.js'

describe('partials analyzer', () => {
  describe('extractReferences', () => {
    it('extracts partial references from template string', () => {
      const template = `
        <div>{{> header}}</div>
        {{> nav.menu}}
        {{#> modal}}content{{/modal}}
      `
      const refs = extractReferences(template)
      expect(refs.has('header')).toBe(true)
      expect(refs.has('nav.menu')).toBe(true)
      expect(refs.has('modal')).toBe(true)
      expect(refs.has('footer')).toBe(false)
    })
  })

  describe('findUnusedPartials', () => {
    it('detects which partials are never referenced', () => {
      const normalPartialsByFolder = {
        'src/components': ['header', 'unusedCard'],
      }
      const folderPartialsInfo = [
        { name: 'folder.components', folderPath: 'src/components' },
      ]
      const pluginPartials = {
        'seo.meta': '<meta/>',
        'seo.unused': '<unused/>',
      }
      const refs = new Set(['header', 'folder.components', 'seo.meta'])

      const unused = findUnusedPartials(
        normalPartialsByFolder,
        folderPartialsInfo,
        pluginPartials,
        refs,
      )

      const unusedNames = unused.map(u => u.name)
      expect(unusedNames).toContain('unusedCard')
      expect(unusedNames).toContain('seo.unused')
      expect(unusedNames).not.toContain('header')
      expect(unusedNames).not.toContain('folder.components')
    })
  })

  describe('propagateReferences', () => {
    it('propagates child references when a folder partial is in refs', () => {
      const refs = new Set(['folder.widgets'])
      const partials = {
        'folder.widgets': { template: '{{> widgetA}}\n{{> widgetB}}' },
        'folder.other': { template: '{{> otherA}}' },
      }

      propagateReferences(refs, partials)

      expect(refs.has('folder.widgets')).toBe(true)
      expect(refs.has('widgetA')).toBe(true)
      expect(refs.has('widgetB')).toBe(true)
      expect(refs.has('folder.other')).toBe(false)
      expect(refs.has('otherA')).toBe(false)
    })

    it('handles transitive nested folder references cleanly', () => {
      const refs = new Set(['folder.parent'])
      const partials = {
        'folder.parent': { template: '{{> folder.child}}\n{{> parentItem}}' },
        'folder.child': { template: '{{> childItem}}' },
      }

      propagateReferences(refs, partials)

      expect(refs.has('folder.parent')).toBe(true)
      expect(refs.has('folder.child')).toBe(true)
      expect(refs.has('parentItem')).toBe(true)
      expect(refs.has('childItem')).toBe(true)
    })
  })

  describe('analyzePartials', () => {
    it('returns refs and triggers progress callback across analysis phases', async () => {
      const tmp = createTempDir('hamlet-analyze-')
      try {
        fs.writeFileSync(path.join(tmp.dir, 'theme.xml'), '<div>{{> nav}}</div>')
        fs.writeFileSync(path.join(tmp.dir, '_nav.hbs'), '<nav>menu</nav>')
        fs.writeFileSync(path.join(tmp.dir, '_unused.hbs'), '<footer>foot</footer>')

        const progressSpy = vi.fn()
        const result = await analyzePartials({ input: tmp.dir }, progressSpy)

        expect(progressSpy).toHaveBeenCalledWith('analyzing partials...')
        expect(progressSpy).toHaveBeenCalledWith('analyzing references...')

        expect(result.refs instanceof Set).toBe(true)
        expect(result.refs.has('nav')).toBe(true)
        expect(result.refs.has('unused')).toBe(false)
        expect(result.unused.map(u => u.name)).toContain('unused')
      }
      finally {
        tmp.cleanup()
      }
    })

    it('marks directly referenced partial as used while unreferenced sibling remains unused', async () => {
      const tmp = createTempDir('hamlet-analyze-direct-')
      try {
        const navDir = path.join(tmp.dir, 'nav')
        fs.mkdirSync(navDir)
        fs.writeFileSync(path.join(navDir, '_item.hbs'), '<li>item</li>')
        fs.writeFileSync(path.join(navDir, '_menu.hbs'), '<nav>menu</nav>')
        fs.writeFileSync(path.join(tmp.dir, 'theme.xml'), '<html>{{> item}}</html>')

        const result = await analyzePartials({ input: tmp.dir })

        expect(result.refs.has('item')).toBe(true)
        expect(result.refs.has('menu')).toBe(false)
        expect(result.refs.has('folder.nav')).toBe(false)

        const unusedNames = result.unused.map(u => u.name)
        expect(unusedNames).toContain('menu')
        expect(unusedNames).toContain('folder.nav')
        expect(unusedNames).not.toContain('item')
      }
      finally {
        tmp.cleanup()
      }
    })

    it('marks all partials in a referenced folder as used even without direct references', async () => {
      const tmp = createTempDir('hamlet-analyze-folder-')
      try {
        const widgetsDir = path.join(tmp.dir, 'widgets')
        fs.mkdirSync(widgetsDir)
        fs.writeFileSync(path.join(widgetsDir, '_widgetA.hbs'), '<div>A</div>')
        fs.writeFileSync(path.join(widgetsDir, '_widgetB.hbs'), '<div>B</div>')
        fs.writeFileSync(path.join(widgetsDir, '_widgetC.hbs'), '<div>C</div>')
        // Only the folder is referenced, none of the individual partials directly
        fs.writeFileSync(path.join(tmp.dir, 'theme.xml'), '<html>{{> folder.widgets}}</html>')

        const result = await analyzePartials({ input: tmp.dir })

        expect(result.refs.has('folder.widgets')).toBe(true)
        expect(result.refs.has('widgetA')).toBe(true)
        expect(result.refs.has('widgetB')).toBe(true)
        expect(result.refs.has('widgetC')).toBe(true)

        const unusedNames = result.unused.map(u => u.name)
        expect(unusedNames).not.toContain('folder.widgets')
        expect(unusedNames).not.toContain('widgetA')
        expect(unusedNames).not.toContain('widgetB')
        expect(unusedNames).not.toContain('widgetC')
      }
      finally {
        tmp.cleanup()
      }
    })

    it('marks unreferenced folder and all its partials as unused', async () => {
      const tmp = createTempDir('hamlet-analyze-unref-')
      try {
        const cardsDir = path.join(tmp.dir, 'cards')
        fs.mkdirSync(cardsDir)
        fs.writeFileSync(path.join(cardsDir, '_cardA.hbs'), '<div>Card A</div>')
        fs.writeFileSync(path.join(cardsDir, '_cardB.hbs'), '<div>Card B</div>')
        // Template references nothing
        fs.writeFileSync(path.join(tmp.dir, 'theme.xml'), '<html><body>Hello</body></html>')

        const result = await analyzePartials({ input: tmp.dir })

        expect(result.refs.has('folder.cards')).toBe(false)
        expect(result.refs.has('cardA')).toBe(false)
        expect(result.refs.has('cardB')).toBe(false)

        const unusedNames = result.unused.map(u => u.name)
        expect(unusedNames).toContain('folder.cards')
        expect(unusedNames).toContain('cardA')
        expect(unusedNames).toContain('cardB')
      }
      finally {
        tmp.cleanup()
      }
    })

    it('correctly handles combination of direct and indirect folder references', async () => {
      const tmp = createTempDir('hamlet-analyze-mixed-')
      try {
        const navDir = path.join(tmp.dir, 'nav')
        const cardsDir = path.join(tmp.dir, 'cards')
        fs.mkdirSync(navDir)
        fs.mkdirSync(cardsDir)

        fs.writeFileSync(path.join(navDir, '_item.hbs'), '<li>item</li>')
        fs.writeFileSync(path.join(navDir, '_menu.hbs'), '<nav>menu</nav>')
        fs.writeFileSync(path.join(cardsDir, '_cardA.hbs'), '<div>Card A</div>')
        fs.writeFileSync(path.join(cardsDir, '_cardB.hbs'), '<div>Card B</div>')

        // folder.nav is referenced (indirectly using item and menu), and cardA is directly referenced
        fs.writeFileSync(path.join(tmp.dir, 'theme.xml'), '<html>{{> folder.nav}}{{> cardA}}</html>')

        const result = await analyzePartials({ input: tmp.dir })

        // Used
        expect(result.refs.has('folder.nav')).toBe(true)
        expect(result.refs.has('item')).toBe(true)
        expect(result.refs.has('menu')).toBe(true)
        expect(result.refs.has('cardA')).toBe(true)

        // Unused
        expect(result.refs.has('folder.cards')).toBe(false)
        expect(result.refs.has('cardB')).toBe(false)

        const unusedNames = result.unused.map(u => u.name)
        expect(unusedNames).toContain('folder.cards')
        expect(unusedNames).toContain('cardB')
        expect(unusedNames).not.toContain('folder.nav')
        expect(unusedNames).not.toContain('item')
        expect(unusedNames).not.toContain('menu')
        expect(unusedNames).not.toContain('cardA')
      }
      finally {
        tmp.cleanup()
      }
    })
  })
})
