import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processTemplate } from '../../../lib/templates/blogger-parser.js'
import {
  collectDeclaredSkinVariables,
  expandSkinExpression,
  expandSkinShorthands,
  normalizeSkinVarName,
  resolveSkinVariable,
} from '../../../lib/templates/skin-shorthands.js'

describe('skin Variable Shorthands (Phase 7)', () => {
  describe('normalizeSkinVarName', () => {
    it('preserves names without dots or already with underscores', () => {
      expect(normalizeSkinVarName('brandColor')).toBe('brandColor')
      expect(normalizeSkinVarName('c_uiScheme')).toBe('c_uiScheme')
    })

    it('converts dots to underscores for regular variables', () => {
      expect(normalizeSkinVarName('c.uiScheme')).toBe('c_uiScheme')
      expect(normalizeSkinVarName('a.editShortcut')).toBe('a_editShortcut')
      expect(normalizeSkinVarName('e.showSnippet')).toBe('e_showSnippet')
      expect(normalizeSkinVarName('t.missingJumpLink')).toBe('t_missingJumpLink')
      expect(normalizeSkinVarName('posts.text.color')).toBe('posts_text_color')
    })

    it('respects background subproperties (image, color)', () => {
      expect(normalizeSkinVarName('body.background.image')).toBe('body_background.image')
      expect(normalizeSkinVarName('body.background.color')).toBe('body_background.color')
      expect(normalizeSkinVarName('body_background.image')).toBe('body_background.image')
    })

    it('respects color subproperties (red, green, blue, alpha, inverse, transparent)', () => {
      expect(normalizeSkinVarName('postbg.red')).toBe('postbg.red')
      expect(normalizeSkinVarName('postbg.green')).toBe('postbg.green')
      expect(normalizeSkinVarName('postbg.blue')).toBe('postbg.blue')
      expect(normalizeSkinVarName('postbg.alpha')).toBe('postbg.alpha')
      expect(normalizeSkinVarName('postbg.inverse')).toBe('postbg.inverse')
      expect(normalizeSkinVarName('postbg.transparent')).toBe('postbg.transparent')
      expect(normalizeSkinVarName('posts.text.color.red')).toBe('posts_text_color.red')
      expect(normalizeSkinVarName('posts.text.color.alpha')).toBe('posts_text_color.alpha')
    })

    it('respects font subproperties (size, family)', () => {
      expect(normalizeSkinVarName('fonttitle.size')).toBe('fonttitle.size')
      expect(normalizeSkinVarName('fonttitle.family')).toBe('fonttitle.family')
      expect(normalizeSkinVarName('font.title.size')).toBe('font_title.size')
      expect(normalizeSkinVarName('font.title.family')).toBe('font_title.family')
    })

    it('handles invalid inputs gracefully', () => {
      expect(normalizeSkinVarName(null)).toBe('')
      expect(normalizeSkinVarName(undefined)).toBe('')
    })
  })

  describe('expandSkinExpression', () => {
    it('expands skin:variable in expression', () => {
      expect(expandSkinExpression('skin:c.uiScheme == "dark"')).toBe(
        'data:skin.vars.c_uiScheme == "dark"',
      )
    })

    it('expands $skin.variable in expression', () => {
      expect(expandSkinExpression('$skin.c.uiScheme == "dark"')).toBe(
        'data:skin.vars.c_uiScheme == "dark"',
      )
    })

    it('handles expressions with subproperties', () => {
      expect(expandSkinExpression('skin:body.background.image')).toBe(
        'data:skin.vars.body_background.image',
      )
      expect(expandSkinExpression('skin:postbg.alpha')).toBe(
        'data:skin.vars.postbg.alpha',
      )
    })

    it('protects string literals inside expressions from being expanded', () => {
      expect(expandSkinExpression('skin:c.uiScheme == "skin:literal"')).toBe(
        'data:skin.vars.c_uiScheme == "skin:literal"',
      )
      expect(expandSkinExpression('skin:mode == \'$skin.literal\'')).toBe(
        'data:skin.vars.mode == \'$skin.literal\'',
      )
    })
  })

  describe('expandSkinShorthands (XML nodes)', () => {
    it('transforms self-closing <skin:variable/> elements to <data:skin.vars.variable/>', () => {
      const input = '<div><skin:t.missingJumpLink/></div>'
      expect(expandSkinShorthands(input)).toBe('<div><data:skin.vars.t_missingJumpLink/></div>')
    })

    it('transforms paired <skin:variable></skin:variable> elements to self-closing data tag', () => {
      const input = '<div><skin:c.avatar></skin:c.avatar></div>'
      expect(expandSkinShorthands(input)).toBe('<div><data:skin.vars.c_avatar/></div>')
    })

    it('transforms <skin:variable/> with subproperties', () => {
      const input = '<div><skin:font.title.family/></div>'
      expect(expandSkinShorthands(input)).toBe('<div><data:skin.vars.font_title.family/></div>')
    })
  })

  describe('expandSkinShorthands (Attributes and expressions)', () => {
    it('expands inside cond attribute', () => {
      const input = '<b:if cond=\'["dark","light"] contains skin:c.uiScheme\'/>'
      expect(expandSkinShorthands(input)).toBe(
        '<b:if cond=\'["dark","light"] contains data:skin.vars.c_uiScheme\'/>',
      )
    })

    it('expands inside expr:* attributes', () => {
      const input = '<b:attr name=\'data-theme\' expr:value=\'skin:c.uiScheme\'/>'
      expect(expandSkinShorthands(input)).toBe(
        '<b:attr name=\'data-theme\' expr:value=\'data:skin.vars.c_uiScheme\'/>',
      )
    })

    it('expands inside data object attributes', () => {
      const input = '<b:include name=\'header\' data=\'{ title: skin:t.sources, icon: "chain" }\'/>'
      expect(expandSkinShorthands(input)).toBe(
        '<b:include name=\'header\' data=\'{ title: data:skin.vars.t_sources, icon: "chain" }\'/>',
      )
    })

    it('expands inside value and values attributes', () => {
      const input = '<b:with value=\'(data:i + 1) gte skin:e.lazyStart ? "lazy" : ""\' var=\'lazy\'/>'
      expect(expandSkinShorthands(input)).toBe(
        '<b:with value=\'(data:i + 1) gte data:skin.vars.e_lazyStart ? "lazy" : ""\' var=\'lazy\'/>',
      )
    })

    it('protects CDATA, script, and style blocks', () => {
      const input = `
        <script>const x = skin:c.uiScheme;</script>
        <style>.foo { content: "skin:c.uiScheme"; }</style>
        <![CDATA[skin:c.uiScheme]]>
        <b:if cond='skin:c.uiScheme == "dark"'/>
      `
      const output = expandSkinShorthands(input)
      expect(output).toContain('const x = skin:c.uiScheme;')
      expect(output).toContain('.foo { content: "skin:c.uiScheme"; }')
      expect(output).toContain('<![CDATA[skin:c.uiScheme]]>')
      expect(output).toContain('data:skin.vars.c_uiScheme == "dark"')
    })
  })

  describe('full pipeline integration in processTemplate', () => {
    it('processes real-world patterns from basico.xml and laertes.xml', () => {
      const input = `<html><body>
        <b:if cond='["dark","light"] contains skin:c.uiScheme'>
          <b:attr name='data-theme' expr:value='skin:c.uiScheme'/>
        </b:if>
        <skin:t.missingJumpLink/>
        <b:include name='card' data='{ title: skin:t.sources, bg: skin:body.background.image }'/>
      </body></html>`

      const output = processTemplate(input)

      expect(output).toContain('data:skin.vars.c_uiScheme')
      expect(output).toContain('<data:skin.vars.t_missingJumpLink/>')
      expect(output).toContain('data:skin.vars.t_sources')
      expect(output).toContain('data:skin.vars.body_background.image')
      expect(output).not.toContain('skin:c.uiScheme')
      expect(output).not.toContain('<skin:')
    })

    it('preserves native data:skin.vars.xxx completely intact', () => {
      const input = `<html><body>
        <b:if cond='data:skin.vars.c_uiScheme == "dark"'/>
        <data:skin.vars.t_missingJumpLink/>
      </body></html>`

      const output = processTemplate(input)

      expect(output).toContain('data:skin.vars.c_uiScheme == "dark"')
      expect(output).toContain('<data:skin.vars.t_missingJumpLink/>')
    })
  })

  describe('context-aware variable collection and validation diagnostics', () => {
    let warnSpy

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warnSpy.mockRestore()
    })

    it('collects declared variables from template correctly', () => {
      const template = `
        <b:skin>
          <Variable name="c.uiScheme" type="string" default="dark"/>
          <Variable name="postbg" type="color" default="#fff"/>
          <Variable name="body.background" type="background"/>
          <Variable name="font.title" type="font"/>
        </b:skin>
      `
      const vars = collectDeclaredSkinVariables(template)

      expect(vars.size).toBe(7)
      expect(vars.get('c.uiScheme')).toEqual({
        name: 'c.uiScheme',
        normalizedName: 'c_uiScheme',
        type: 'string',
      })
      expect(vars.get('postbg')).toEqual({
        name: 'postbg',
        normalizedName: 'postbg',
        type: 'color',
      })
      expect(vars.get('font.title')).toEqual({
        name: 'font.title',
        normalizedName: 'font_title',
        type: 'font',
      })
    })

    it('resolves valid declared variables and allowed subproperties without warnings', () => {
      const template = `
        <b:skin>
          <Variable name="c.uiScheme" type="string"/>
          <Variable name="postbg" type="color"/>
          <Variable name="body.bg" type="background"/>
          <Variable name="font.heading" type="font"/>
        </b:skin>
      `
      const vars = collectDeclaredSkinVariables(template)

      expect(resolveSkinVariable('c.uiScheme', vars)).toBe('c_uiScheme')
      expect(resolveSkinVariable('postbg.alpha', vars)).toBe('postbg.alpha')
      expect(resolveSkinVariable('postbg.red', vars)).toBe('postbg.red')
      expect(resolveSkinVariable('body.bg.image', vars)).toBe('body_bg.image')
      expect(resolveSkinVariable('body.bg.color', vars)).toBe('body_bg.color')
      expect(resolveSkinVariable('font.heading.size', vars)).toBe('font_heading.size')
      expect(resolveSkinVariable('font.heading.family', vars)).toBe('font_heading.family')

      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('warns when an undeclared skin variable is used in template', () => {
      const template = `
        <b:skin>
          <Variable name="c.uiScheme" type="string"/>
        </b:skin>
        <div><skin:undeclaredVar/></div>
      `
      expandSkinShorthands(template)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('The skin variable "undeclaredVar" is used but not declared in <b:skin>'),
      )
    })

    it('warns when a subproperty is used on a variable type that does not support subproperties', () => {
      const template = `
        <b:skin>
          <Variable name="c.uiScheme" type="string"/>
        </b:skin>
        <b:if cond='skin:c.uiScheme.size == "12px"'/>
      `
      expandSkinShorthands(template)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not have subproperties'),
      )
    })

    it('warns when an invalid subproperty is used on color, font or background', () => {
      const template = `
        <b:skin>
          <Variable name="postbg" type="color"/>
          <Variable name="font.heading" type="font"/>
          <Variable name="body.bg" type="background"/>
        </b:skin>
        <b:if cond='skin:postbg.size == "12px"'/>
        <b:if cond='skin:font.heading.red == "true"'/>
        <b:if cond='skin:body.bg.alpha == "1"'/>
      `
      expandSkinShorthands(template)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('The skin variable "postbg" of type "color" does not support the subproperty ".size"'),
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('The skin variable "font.heading" of type "font" does not support the subproperty ".red"'),
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('The skin variable "body.bg" of type "background" does not support the subproperty ".alpha"'),
      )
    })
  })
})
