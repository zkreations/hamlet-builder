import { describe, expect, it } from 'vitest'
import { processTemplate } from '../../../lib/templates/blogger-parser.js'

describe('blogger parser', () => {
  describe('rootAttributes', () => {
    it('injects required Blogger attributes into <html> tag', () => {
      const input = '<html><head></head><body></body></html>'
      const output = processTemplate(input)
      expect(output).toContain('b:css=\'false\'')
      expect(output).toContain('b:js=\'false\'')
      expect(output).toContain('b:defaultwidgetversion=\'2\'')
      expect(output).toContain('b:layoutsVersion=\'3\'')
      expect(output).toContain('expr:dir=\'data:blog.languageDirection\'')
      expect(output).toContain('expr:lang=\'data:blog.locale\'')
    })

    it('does not duplicate existing attributes on <html> tag', () => {
      const input = '<html b:css="false"><head></head></html>'
      const output = processTemplate(input)
      const matches = output.match(/b:css/g)
      expect(matches?.length).toBe(1)
    })
  })

  describe('voidElements', () => {
    it('self-closes void tags that are open', () => {
      const input = '<html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><img src="pic.jpg"><br></body></html>'
      const output = processTemplate(input)
      expect(output).toContain('<meta charset="utf-8"/>')
      expect(output).toContain('<link rel="stylesheet" href="style.css"/>')
      expect(output).toContain('<img src="pic.jpg"/>')
      expect(output).toContain('<br/>')
    })

    it('preserves paired tags like <meta>...</meta>', () => {
      const input = '<html><head><meta><b:attr name="content" expr:value="data:title"/></meta></head></html>'
      const output = processTemplate(input)
      expect(output).toContain('<meta><b:attr')
      expect(output).toContain('</meta>')
    })
  })

  describe('widgetAttributes', () => {
    it('normalizes widgets with auto id, version and default HTML type', () => {
      const input = '<html><body><b:widget/></body></html>'
      const output = processTemplate(input)
      expect(output).toContain('type=\'HTML\'')
      expect(output).toContain('version=\'2\'')
      expect(output).toContain('id=\'HTML1\'')
    })

    it('increments id counter for same widget type', () => {
      const input = '<html><body><b:widget type="HTML"/><b:widget type="HTML"/></body></html>'
      const output = processTemplate(input)
      expect(output).toContain('id=\'HTML1\'')
      expect(output).toContain('id=\'HTML2\'')
    })
  })

  describe('variableAttributes', () => {
    it('expands variable definition with type and description', () => {
      const input = '<html><Variable name="themeColor" value="#ff0000"/></html>'
      const output = processTemplate(input)
      expect(output).toContain('name="themeColor"')
      expect(output).toContain('description="themeColor"')
      expect(output).toContain('type="string"')
    })

    it('throws error if Variable element lacks name attribute', () => {
      const input = '<html><Variable value="#ff0000"/></html>'
      expect(() => processTemplate(input)).toThrow('The name attribute is required for the Variable element.')
    })
  })
})
