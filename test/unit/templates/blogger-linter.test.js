import { describe, expect, it } from 'vitest'
import {
  computeLineAndColumn,
  formatDiagnostics,
  isValidBloggerColor,
  isValidBloggerLength,
  lintBloggerTemplate,
} from '../../../lib/templates/blogger-linter.js'

describe('blogger Linter and Static Diagnostics (Phase 8)', () => {
  describe('computeLineAndColumn', () => {
    it('returns 1:1 for start of document or empty source', () => {
      expect(computeLineAndColumn('', 0)).toEqual({ line: 1, column: 1 })
      expect(computeLineAndColumn('hello', 0)).toEqual({ line: 1, column: 1 })
    })

    it('computes exact line and column across multiple lines', () => {
      const source = 'line 1\nline 2\nline 3: target'
      const targetIndex = source.indexOf('target')
      expect(computeLineAndColumn(source, targetIndex)).toEqual({ line: 3, column: 9 })
    })
  })

  describe('isValidBloggerColor', () => {
    it('accepts valid Blogger color formats', () => {
      expect(isValidBloggerColor('#fff')).toBe(true)
      expect(isValidBloggerColor('#FFF')).toBe(true)
      expect(isValidBloggerColor('#ffffff')).toBe(true)
      expect(isValidBloggerColor('#FFFFFF')).toBe(true)
      expect(isValidBloggerColor('rgb(255, 255, 255)')).toBe(true)
      expect(isValidBloggerColor('rgb(0,0,0)')).toBe(true)
      expect(isValidBloggerColor('rgba(255, 255, 255, 0.5)')).toBe(true)
      expect(isValidBloggerColor('rgba(0, 0, 0, 1)')).toBe(true)
      expect(isValidBloggerColor('transparent')).toBe(true)
      expect(isValidBloggerColor('TRANSPARENT')).toBe(true)
    })

    it('rejects unsupported or modern color formats that break Blogger', () => {
      expect(isValidBloggerColor('#ffffffff')).toBe(false)
      expect(isValidBloggerColor('#ffffff00')).toBe(false)
      expect(isValidBloggerColor('#ffff')).toBe(false)

      expect(isValidBloggerColor('hsl(0, 100%, 50%)')).toBe(false)
      expect(isValidBloggerColor('oklch(0.5 0.2 180)')).toBe(false)
      expect(isValidBloggerColor('rgb(255 255 255 / 0.5)')).toBe(false)
      expect(isValidBloggerColor('color-mix(in srgb, red, blue)')).toBe(false)
      expect(isValidBloggerColor('blue')).toBe(false)
      expect(isValidBloggerColor('12px')).toBe(false)
    })
  })

  describe('isValidBloggerLength', () => {
    it('accepts valid Blogger length units (px, em)', () => {
      expect(isValidBloggerLength('10px')).toBe(true)
      expect(isValidBloggerLength('0px')).toBe(true)
      expect(isValidBloggerLength('-5px')).toBe(true)
      expect(isValidBloggerLength('1.5em')).toBe(true)
      expect(isValidBloggerLength('0.8em')).toBe(true)
      expect(isValidBloggerLength('-0.5em')).toBe(true)
    })

    it('rejects other units or unitless values that break Blogger', () => {
      expect(isValidBloggerLength('10rem')).toBe(false)
      expect(isValidBloggerLength('100%')).toBe(false)
      expect(isValidBloggerLength('50vh')).toBe(false)
      expect(isValidBloggerLength('10pt')).toBe(false)
      expect(isValidBloggerLength('100')).toBe(false)
      expect(isValidBloggerLength('auto')).toBe(false)
    })
  })

  describe('rule: defaultmarkup-valid-type', () => {
    it('passes for native widget types, defaultmarkup groups, and Common', () => {
      const template = `
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='main'/>
          </b:defaultmarkup>
          <b:defaultmarkup type='Common'>
            <b:includable id='header'/>
          </b:defaultmarkup>
          <b:defaultmarkup type='All'>
            <b:includable id='content'/>
          </b:defaultmarkup>
          <b:defaultmarkup type='AdSense,Blog'>
            <b:includable id='ad'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
      `
      const diags = lintBloggerTemplate(template)
      const typeDiags = diags.filter(d => d.rule === 'defaultmarkup-valid-type')
      expect(typeDiags).toHaveLength(0)
    })

    it('reports error for unsupported defaultmarkup types', () => {
      const template = `
        <b:defaultmarkups>
          <b:defaultmarkup type='CustomWidget'>
            <b:includable id='main'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
      `
      const diags = lintBloggerTemplate(template)
      const typeDiag = diags.find(d => d.rule === 'defaultmarkup-valid-type')
      expect(typeDiag).toBeDefined()
      expect(typeDiag.severity).toBe('error')
      expect(typeDiag.message).toContain('CustomWidget')
    })
  })

  describe('rule: variable-valid-type', () => {
    it('passes for valid Blogger variable types', () => {
      const template = `
        <b:skin>
          <Variable name='colorVar' type='color' value='#ffffff'/>
          <Variable name='lengthVar' type='length' value='12px'/>
          <Variable name='fontVar' type='font'/>
          <Variable name='stringVar' type='string'/>
          <Variable name='bgVar' type='background'/>
          <Variable name='imgVar' type='image'/>
        </b:skin>
      `
      const diags = lintBloggerTemplate(template)
      const varDiags = diags.filter(d => d.rule === 'variable-valid-type')
      expect(varDiags).toHaveLength(0)
    })

    it('reports error for invalid variable types (boolean, number, etc.)', () => {
      const template = `
        <b:skin>
          <Variable name='flag' type='boolean' value='true'/>
          <Variable name='count' type='number' value='10'/>
        </b:skin>
      `
      const diags = lintBloggerTemplate(template)
      const varDiags = diags.filter(d => d.rule === 'variable-valid-type')
      expect(varDiags).toHaveLength(2)
      expect(varDiags[0].message).toContain('boolean')
      expect(varDiags[1].message).toContain('number')
    })
  })

  describe('rule: variable-strict-color', () => {
    it('passes for valid color formats in variables', () => {
      const template = `
        <b:skin>
          <Variable name='bg' type='color' value='#fff'/>
          <Variable name='postBg' type='color' value='#ffffff' default='#000000'/>
          <Variable name='overlay' type='color' value='rgba(0, 0, 0, 0.5)'/>
          <Variable name='clear' type='color' value='transparent'/>
        </b:skin>
      `
      const diags = lintBloggerTemplate(template)
      const colorDiags = diags.filter(d => d.rule === 'variable-strict-color')
      expect(colorDiags).toHaveLength(0)
    })

    it('reports error for 8-digit hex (#ffffffff) with opacity', () => {
      const template = `
        <b:skin>
          <Variable name='bg' type='color' value='#ffffffff'/>
        </b:skin>
      `
      const diags = lintBloggerTemplate(template)
      const colorDiag = diags.find(d => d.rule === 'variable-strict-color')
      expect(colorDiag).toBeDefined()
      expect(colorDiag.message).toContain('#ffffffff')
    })

    it('reports error for modern color functions (hsl, oklch, modern rgb)', () => {
      const template = `
        <b:skin>
          <Variable name='primary' type='color' value='hsl(210, 100%, 50%)'/>
          <Variable name='secondary' type='color' value='rgb(255 0 0 / 0.5)'/>
        </b:skin>
      `
      const diags = lintBloggerTemplate(template)
      const colorDiags = diags.filter(d => d.rule === 'variable-strict-color')
      expect(colorDiags).toHaveLength(2)
    })
  })

  describe('rule: variable-strict-length', () => {
    it('passes for valid px and em length units in value, default, min, max, minmax', () => {
      const template = `
        <b:skin>
          <Variable name='w' type='length' value='200px' min='100px' max='400px'/>
          <Variable name='lh' type='length' value='1.5em'/>
          <Variable name='card' minmax='150px, 300px' value='200px'/>
        </b:skin>
      `
      const diags = lintBloggerTemplate(template)
      const lenDiags = diags.filter(d => d.rule === 'variable-strict-length')
      expect(lenDiags).toHaveLength(0)
    })

    it('reports error for unsupported length units (rem, %, vh, unitless)', () => {
      const template = `
        <b:skin>
          <Variable name='w' type='length' value='10rem'/>
          <Variable name='pct' type='length' value='100%'/>
          <Variable name='num' type='length' value='200'/>
          <Variable name='badMinmax' minmax='10rem, 20rem'/>
        </b:skin>
      `
      const diags = lintBloggerTemplate(template)
      const lenDiags = diags.filter(d => d.rule === 'variable-strict-length')
      expect(lenDiags.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('rule: skin-undeclared-variable and skin-invalid-subproperty', () => {
    it('reports error when undeclared skin variable is used', () => {
      const template = `
        <b:skin>
          <Variable name='theme' type='string' value='dark'/>
        </b:skin>
        <div><skin:missingVar/></div>
      `
      const diags = lintBloggerTemplate(template)
      const undeclared = diags.find(d => d.rule === 'skin-undeclared-variable')
      expect(undeclared).toBeDefined()
      expect(undeclared.message).toContain('missingVar')
    })

    it('passes when valid skin variables and allowed subproperties are used', () => {
      const template = `
        <b:skin>
          <Variable name='theme' type='string' value='dark'/>
          <Variable name='postBg' type='color' value='#ffffff'/>
          <Variable name='siteBg' type='background'/>
          <Variable name='siteFont' type='font'/>
        </b:skin>
        <b:if cond='skin:theme == "dark"'/>
        <div expr:style='skin:siteBg.image'/>
        <div expr:style='skin:siteBg.color'/>
        <div expr:style='skin:postBg.alpha'/>
        <div expr:style='skin:postBg.red'/>
        <div expr:style='skin:siteFont.size'/>
        <div expr:style='skin:siteFont.family'/>
      `
      const diags = lintBloggerTemplate(template)
      const skinDiags = diags.filter(d => d.rule.startsWith('skin-'))
      expect(skinDiags).toHaveLength(0)
    })

    it('reports error when invalid subproperty is used for a variable type', () => {
      const template = `
        <b:skin>
          <Variable name='postBg' type='color' value='#ffffff'/>
          <Variable name='siteFont' type='font'/>
          <Variable name='theme' type='string' value='dark'/>
        </b:skin>
        <div expr:style='skin:postBg.size'/>
        <div expr:style='skin:siteFont.red'/>
        <div expr:style='skin:theme.image'/>
      `
      const diags = lintBloggerTemplate(template)
      const subDiags = diags.filter(d => d.rule === 'skin-invalid-subproperty')
      expect(subDiags).toHaveLength(3)
    })
  })

  describe('rule: unique-element-ids', () => {
    it('reports error on duplicate widget IDs', () => {
      const template = `
        <b:section id='sec1'>
          <b:widget id='Header1' type='Header'/>
          <b:widget id='Header1' type='Header'/>
        </b:section>
      `
      const diags = lintBloggerTemplate(template)
      const idDiag = diags.find(d => d.rule === 'unique-element-ids')
      expect(idDiag).toBeDefined()
      expect(idDiag.message).toContain('Header1')
    })

    it('reports error on duplicate section IDs', () => {
      const template = `
        <b:section id='mainSec'/>
        <b:section id='mainSec'/>
      `
      const diags = lintBloggerTemplate(template)
      const idDiag = diags.find(d => d.rule === 'unique-element-ids')
      expect(idDiag).toBeDefined()
      expect(idDiag.message).toContain('mainSec')
    })
  })

  describe('rules: widget-inside-section and section-nesting', () => {
    it('reports error when widget is placed outside section', () => {
      const template = `
        <b:widget id='orphanWidget' type='HTML'/>
      `
      const diags = lintBloggerTemplate(template)
      const wDiag = diags.find(d => d.rule === 'widget-inside-section')
      expect(wDiag).toBeDefined()
      expect(wDiag.message).toContain('orphanWidget')
    })

    it('reports error when section is nested inside another section', () => {
      const template = `
        <b:section id='outer'>
          <b:section id='inner'/>
        </b:section>
      `
      const diags = lintBloggerTemplate(template)
      const sDiag = diags.find(d => d.rule === 'section-nesting')
      expect(sDiag).toBeDefined()
    })
  })

  describe('rule: unique-includable-ids', () => {
    it('reports error on duplicate includable IDs within the same widget', () => {
      const template = `
        <b:section id='main'>
          <b:widget id='Blog1' type='Blog'>
            <b:includable id='main'/>
            <b:includable id='main'/>
          </b:widget>
        </b:section>
      `
      const diags = lintBloggerTemplate(template)
      const incDiag = diags.find(d => d.rule === 'unique-includable-ids')
      expect(incDiag).toBeDefined()
      expect(incDiag.message).toContain('main')
    })

    it('allows identical includable IDs across different widgets or containers', () => {
      const template = `
        <b:section id='main'>
          <b:widget id='Blog1' type='Blog'>
            <b:includable id='main'/>
          </b:widget>
          <b:widget id='Blog2' type='Blog'>
            <b:includable id='main'/>
          </b:widget>
        </b:section>
      `
      const diags = lintBloggerTemplate(template)
      const incDiags = diags.filter(d => d.rule === 'unique-includable-ids')
      expect(incDiags).toHaveLength(0)
    })
  })

  describe('formatDiagnostics', () => {
    it('formats diagnostic array to readable string', () => {
      const diags = [
        {
          rule: 'variable-strict-color',
          severity: 'error',
          message: 'Invalid color format',
          line: 12,
          column: 5,
        },
      ]
      const output = formatDiagnostics(diags, 'theme.xml')
      expect(output).toBe('[ERROR] variable-strict-color: Invalid color format (theme.xml:12:5)')
    })

    it('returns empty string if diagnostics list is empty', () => {
      expect(formatDiagnostics([])).toBe('')
    })
  })
})
