import { describe, expect, it } from 'vitest'
import {
  processTemplate,
  sectionAttributes,
  variableAttributes,
} from '../../../lib/templates/blogger-parser.js'

describe('section and variable normalization (Fase 3)', () => {
  describe('sectionAttributes (<b:section>)', () => {
    it('generates incremental deterministic IDs (section1, section2, section3)', () => {
      const input = '<html><body><b:section/><b:section class="sidebar"/><b:section/></body></html>'
      const output = processTemplate(input)

      expect(output).toContain('<b:section id=\'section1\'/>')
      expect(output).toContain('<b:section id=\'section2\' class="sidebar"/>')
      expect(output).toContain('<b:section id=\'section3\'/>')
    })

    it('coexists peacefully with existing explicit IDs and avoids collisions', () => {
      const input = '<html><body><b:section id="header"/><b:section/><b:section id="section1"/><b:section/></body></html>'
      const output = processTemplate(input)

      expect(output).toContain('<b:section id="header"/>')
      expect(output).toContain('<b:section id=\'section2\'/>')
      expect(output).toContain('<b:section id="section1"/>')
      expect(output).toContain('<b:section id=\'section3\'/>')
    })

    it('preserves paired sections with content and custom attributes', () => {
      const input = '<b:section class="content flex" maxwidgets="5"><b:widget/></b:section>'
      const output = processTemplate(input)

      expect(output).toContain('<b:section id=\'section1\' class="content flex" maxwidgets="5">')
      expect(output).toContain('</b:section>')
    })

    it('preserves section that already has explicit id', () => {
      const ctx = { counter: 1, usedIds: new Set(['footer']) }
      const input = '<b:section id="footer" class="site-footer"/>'
      expect(sectionAttributes(input, ctx)).toBe(input)
    })
  })

  describe('variableAttributes (<Variable>) - strict color inference', () => {
    it('infers type="color" and injects default for valid 3/6-digit hex colors', () => {
      const output1 = variableAttributes('<Variable name="primary" value="#14b8a6"/>')
      expect(output1).toContain('type="color"')
      expect(output1).toContain('default="#14b8a6"')

      const output2 = variableAttributes('<Variable name="bg" value="#fff"/>')
      expect(output2).toContain('type="color"')
      expect(output2).toContain('default="#fff"')
    })

    it('infers type="color" and injects default for classic rgb/rgba with commas', () => {
      const output1 = variableAttributes('<Variable name="accent" value="rgb(20, 184, 166)"/>')
      expect(output1).toContain('type="color"')
      expect(output1).toContain('default="rgb(20, 184, 166)"')

      const output2 = variableAttributes('<Variable name="overlay" value="rgba(0, 0, 0, 0.5)"/>')
      expect(output2).toContain('type="color"')
      expect(output2).toContain('default="rgba(0, 0, 0, 0.5)"')
    })

    it('falls back to type="string" for unsupported color formats (8-digit hex, hsl, modern syntax)', () => {
      const output1 = variableAttributes('<Variable name="col" value="#14b8a6ff"/>')
      expect(output1).toContain('type="string"')
      expect(output1).not.toContain('default=')

      const output2 = variableAttributes('<Variable name="col2" value="hsl(120, 50%, 50%)"/>')
      expect(output2).toContain('type="string"')
      expect(output2).not.toContain('default=')
    })
  })

  describe('variableAttributes (<Variable>) - strict length inference and minmax shorthand', () => {
    it('infers type="length" and injects default for px and em units', () => {
      const output1 = variableAttributes('<Variable name="width" value="1200px"/>')
      expect(output1).toContain('type="length"')
      expect(output1).toContain('default="1200px"')

      const output2 = variableAttributes('<Variable name="pad" value="2em"/>')
      expect(output2).toContain('type="length"')
      expect(output2).toContain('default="2em"')
    })

    it('falls back to type="string" for units unsupported by Blogger length variables (rem, %)', () => {
      const output = variableAttributes('<Variable name="fontRel" value="1.5rem"/>')
      expect(output).toContain('type="string"')
      expect(output).not.toContain('default=')
    })

    it('expands minmax="min, max" shorthand and infers type="length"', () => {
      const input = '<Variable name="width.container" minmax="900px, 2000px" value="1200px"/>'
      const output = variableAttributes(input)

      expect(output).toContain('name="width.container"')
      expect(output).toContain('type="length"')
      expect(output).toContain('min="900px"')
      expect(output).toContain('max="2000px"')
      expect(output).toContain('value="1200px"')
      expect(output).toContain('default="1200px"')
      expect(output).not.toContain('minmax=')
    })

    it('expands minmax with space-separated values or minmax() function wrapper', () => {
      const output1 = variableAttributes('<Variable name="w1" minmax="900px 2000px" value="1200px"/>')
      expect(output1).toContain('min="900px"')
      expect(output1).toContain('max="2000px"')

      const output2 = variableAttributes('<Variable name="w2" minmax="minmax(200px, 500px)" value="300px"/>')
      expect(output2).toContain('min="200px"')
      expect(output2).toContain('max="500px"')
      expect(output2).toContain('type="length"')
    })
  })

  describe('variableAttributes (<Variable>) - explicit declarations', () => {
    it('preserves explicit type and description declared by developer', () => {
      const input = '<Variable name="font.title" type="font" description="Title Font" value="14px Roboto"/>'
      const output = variableAttributes(input)

      expect(output).toContain('type="font"')
      expect(output).toContain('description="Title Font"')
      expect(output).toContain('default="14px Roboto"')
    })

    it('preserves explicit default value if already specified', () => {
      const input = '<Variable name="keycolor" type="color" value="#2196f3" default="#000000"/>'
      const output = variableAttributes(input)

      expect(output).toContain('default="#000000"')
      expect(output).not.toContain('default="#2196f3"')
    })
  })
})
