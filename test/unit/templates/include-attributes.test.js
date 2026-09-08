import { describe, expect, it, vi } from 'vitest'
import { processTemplate } from '../../../lib/templates/blogger-parser.js'
import {
  formatPropertyValue,
  parseObjectEntries,
  processIncludeElement,
} from '../../../lib/templates/include-attributes.js'

describe('include attributes (Fase 1)', () => {
  describe('parseObjectEntries', () => {
    it('parses empty or whitespace strings', () => {
      expect(parseObjectEntries('').size).toBe(0)
      expect(parseObjectEntries('{}').size).toBe(0)
      expect(parseObjectEntries('  {   }  ').size).toBe(0)
    })

    it('parses simple key-value pairs', () => {
      const entries = parseObjectEntries('{ class: "snippet", count: 10, active: true }')
      expect(entries.get('class')).toBe('"snippet"')
      expect(entries.get('count')).toBe('10')
      expect(entries.get('active')).toBe('true')
    })

    it('respects nested structures with commas (function calls, arrays, objects)', () => {
      const raw = '{ image: resizeImage(data:src, 400, "16:9"), set: [100, 200, 300], meta: { a: 1, b: 2 } }'
      const entries = parseObjectEntries(raw)
      expect(entries.get('image')).toBe('resizeImage(data:src, 400, "16:9")')
      expect(entries.get('set')).toBe('[100, 200, 300]')
      expect(entries.get('meta')).toBe('{ a: 1, b: 2 }')
    })
  })

  describe('formatPropertyValue', () => {
    it('preserves expression when isExpr is true', () => {
      expect(formatPropertyValue('data:post.snippets.long', true)).toBe('data:post.snippets.long')
      expect(formatPropertyValue('data:a ? "yes" : "no"', true)).toBe('data:a ? "yes" : "no"')
    })

    it('formats numbers and booleans as literals', () => {
      expect(formatPropertyValue('100', false)).toBe('100')
      expect(formatPropertyValue('3.14', false)).toBe('3.14')
      expect(formatPropertyValue('-5', false)).toBe('-5')
      expect(formatPropertyValue('true', false)).toBe('true')
      expect(formatPropertyValue('false', false)).toBe('false')
      expect(formatPropertyValue('null', false)).toBe('null')
    })

    it('formats arrays, objects, data references and function calls as expressions', () => {
      expect(formatPropertyValue('[700, 400, 300]', false)).toBe('[700, 400, 300]')
      expect(formatPropertyValue('{ a: 1 }', false)).toBe('{ a: 1 }')
      expect(formatPropertyValue('data:postImage', false)).toBe('data:postImage')
      expect(formatPropertyValue('data:var.ratio', false)).toBe('data:var.ratio')
      expect(formatPropertyValue('data:a ?: data:b', false)).toBe('data:a ?: data:b')
      expect(formatPropertyValue('resizeImage(data:src, 400)', false)).toBe('resizeImage(data:src, 400)')
    })

    it('wraps plain string literals in double quotes', () => {
      expect(formatPropertyValue('card-snippet', false)).toBe('"card-snippet"')
      expect(formatPropertyValue('trash', false)).toBe('"trash"')
      expect(formatPropertyValue('"already-quoted"', false)).toBe('"already-quoted"')
      expect(formatPropertyValue('\'single-quoted\'', false)).toBe('"single-quoted"')
    })
  })

  describe('processIncludeElement', () => {
    it('returns element untouched if not <b:include>', () => {
      const tag = '<b:widget type="HTML"/>'
      expect(processIncludeElement(tag)).toBe(tag)
    })

    it('returns element untouched if no custom arguments are provided', () => {
      const tag1 = '<b:include name=\'main\'/>'
      const tag2 = '<b:include cond=\'data:view.isPost\' name=\'@meta\' data=\'{ a: 1 }\'/>'
      expect(processIncludeElement(tag1)).toBe(tag1)
      expect(processIncludeElement(tag2)).toBe(tag2)
    })

    it('expands direct string, number, and boolean attributes to data object', () => {
      const input = '<b:include name=\'@snippet\' class=\'card-snippet\' length=\'120\' ellipsis=\'false\'/>'
      const output = processIncludeElement(input)
      expect(output).toBe('<b:include name=\'@snippet\' data=\'{ class: "card-snippet", length: 120, ellipsis: false }\'/>')
    })

    it('guarantees mandatory Blogger space after colon in every property', () => {
      const input = '<b:include name=\'@meteor\' icon=\'trash\'/>'
      const output = processIncludeElement(input)
      expect(output).toContain('data=\'{ icon: "trash" }\'')
      expect(output).not.toContain('icon:"trash"')
    })

    it('supports expr:* prefixed attributes, removing expr: in the property key', () => {
      const input = '<b:include name=\'@snippet\' expr:string=\'data:post.snippets.long\' length=\'100\'/>'
      const output = processIncludeElement(input)
      expect(output).toBe('<b:include name=\'@snippet\' data=\'{ string: data:post.snippets.long, length: 100 }\'/>')
    })

    it('supports arrays, canonical data:* expressions, and function calls as direct attributes', () => {
      const input = '<b:include name=\'@picture\' src=\'data:postImage\' class=\'card-image-src image-fit\' resizeSet=\'[700, 400, 300]\' ratio=\'data:var.ratio\'/>'
      const output = processIncludeElement(input)
      expect(output).toBe('<b:include name=\'@picture\' data=\'{ src: data:postImage, class: "card-image-src image-fit", resizeSet: [700, 400, 300], ratio: data:var.ratio }\'/>')
    })

    it('preserves cond and name attributes in standard order', () => {
      const input = '<b:include cond=\'data:var.showSnippet\' name=\'@snippet\' class=\'card-snippet\' length=\'80\'/>'
      const output = processIncludeElement(input)
      expect(output).toBe('<b:include cond=\'data:var.showSnippet\' name=\'@snippet\' data=\'{ class: "card-snippet", length: 80 }\'/>')
    })

    it('merges direct attributes with existing data object literal, with direct attributes taking priority', () => {
      const input = '<b:include name=\'card\' data=\'{ size: 10, class: "default" }\' class=\'featured\' extra=\'true\'/>'
      const output = processIncludeElement(input)
      expect(output).toBe('<b:include name=\'card\' data=\'{ size: 10, class: "featured", extra: true }\'/>')
    })

    it('warns and preserves element if data is not an object literal', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const input = '<b:include name=\'comment:item\' data=\'comment\' class=\'active\'/>'
      const output = processIncludeElement(input)
      expect(output).toBe(input)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot merge direct attributes'))
      vi.restoreAllMocks()
    })
  })

  describe('integration in processTemplate', () => {
    it('compiles <b:include> with direct attributes through the full processTemplate pipeline', () => {
      const template = `
        <html>
          <body>
            <b:include name='@meteor' icon='paper-plane'/>
            <b:include cond='data:show' name='@snippet' class='truncate' expr:string='data:post.snippets.long' length='90'/>
          </body>
        </html>
      `
      const output = processTemplate(template)
      expect(output).toContain('<b:include name=\'@meteor\' data=\'{ icon: "paper-plane" }\'/>')
      expect(output).toContain('<b:include cond=\'data:show\' name=\'@snippet\' data=\'{ class: "truncate", string: data:post.snippets.long, length: 90 }\'/>')
    })

    it('keeps existing legacy <b:include> with data object unchanged', () => {
      const template = `
        <html>
          <body>
            <b:include name='@meteor' data='{ icon: "trash" }'/>
          </body>
        </html>
      `
      const output = processTemplate(template)
      expect(output).toContain('<b:include name=\'@meteor\' data=\'{ icon: "trash" }\'/>')
    })
  })
})
