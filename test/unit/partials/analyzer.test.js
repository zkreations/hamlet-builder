import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { analyzePartials, extractReferences, findUnusedPartials } from '../../../lib/partials/analyzer.js'
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
  })
})
