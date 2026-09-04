import { describe, expect, it } from 'vitest'
import { extractReferences, findUnusedPartials } from '../../../lib/partials/analyzer.js'

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
})
