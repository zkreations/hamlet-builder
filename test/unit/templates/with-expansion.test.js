import { describe, expect, it } from 'vitest'
import { processTemplate } from '../../../lib/templates/blogger-parser.js'
import { expandMultiWith } from '../../../lib/templates/with-expansion.js'

describe('multi-variable <b:with> expansion (Fase 2)', () => {
  it('returns non-string or template without <b:with intact', () => {
    expect(expandMultiWith(null)).toBe(null)
    expect(expandMultiWith(undefined)).toBe(undefined)
    expect(expandMultiWith('<div>hello</div>')).toBe('<div>hello</div>')
  })

  it('preserves native standard <b:with value="..." var="..."> intact', () => {
    const input = '<b:with value=\'data:view.search.label\' var=\'label\'><span><data:label/></span></b:with>'
    expect(expandMultiWith(input)).toBe(input)
  })

  it('preserves native Blogger advanced expressions intact (expr:value and expr:var)', () => {
    const input1 = '<b:with expr:value=\'data:view.search + (data:view.isLabelSearch ? "label" : "query")\' var=\'label\'><span><data:label/></span></b:with>'
    const input2 = '<b:with value=\'data:view.search.label\' expr:var=\'data:view.isLabelSearch ? "label" : "query"\'><span><data:label/></span></b:with>'
    const input3 = '<b:with expr:value=\'"dyn"\' expr:var=\'"dynVar"\'><span>test</span></b:with>'

    expect(expandMultiWith(input1)).toBe(input1)
    expect(expandMultiWith(input2)).toBe(input2)
    expect(expandMultiWith(input3)).toBe(input3)
  })

  it('expands a single variable declaration using var:name', () => {
    const input = '<b:with var:total=\'data:items.size\'><span><data:total/></span></b:with>'
    const output = expandMultiWith(input)
    expect(output).toBe('<b:with value=\'data:items.size\' var=\'total\'><span><data:total/></span></b:with>')
  })

  it('expands multiple variables into strictly nested Blogger <b:with> tags maintaining order', () => {
    const input = `<b:with var:source='data:src.youtubeMaxResDefaultUrl' var:image='resizeImage(data:source, 400, "16:9")' var:servers='[ "content.com/img/a/" ]'>
      <img expr:src='data:image'/>
    </b:with>`

    const output = expandMultiWith(input)

    expect(output).toContain('<b:with value=\'data:src.youtubeMaxResDefaultUrl\' var=\'source\'>')
    expect(output).toContain('<b:with value=\'resizeImage(data:source, 400, "16:9")\' var=\'image\'>')
    expect(output).toContain('<b:with value=\'[ "content.com/img/a/" ]\' var=\'servers\'>')
    expect(output).toContain('<img expr:src=\'data:image\'/>')

    const closeCount = (output.match(/<\/b:with>/g) || []).length
    expect(closeCount).toBe(3)

    const sourceIdx = output.indexOf('var=\'source\'')
    const imageIdx = output.indexOf('var=\'image\'')
    const serversIdx = output.indexOf('var=\'servers\'')
    expect(sourceIdx).toBeLessThan(imageIdx)
    expect(imageIdx).toBeLessThan(serversIdx)
  })

  it('supports multiline <b:with> declarations with line breaks and arbitrary spacing', () => {
    const input = `<b:with
      var:a='1'
      var:b='2'
      var:c='3'>
      <div>content</div>
    </b:with>`

    const output = expandMultiWith(input)
    expect(output).toContain('<b:with value=\'1\' var=\'a\'>')
    expect(output).toContain('<b:with value=\'2\' var=\'b\'>')
    expect(output).toContain('<b:with value=\'3\' var=\'c\'>')
    expect(output).toContain('<div>content</div>')
    expect((output.match(/<\/b:with>/g) || []).length).toBe(3)
  })

  it('correctly handles nested <b:with> structures with independent scopes', () => {
    const input = `<b:with var:outer='1' var:extra='2'>
      <div>
        <b:with var:inner='3'>
          <span>nested</span>
        </b:with>
      </div>
    </b:with>`

    const output = expandMultiWith(input)
    expect(output).toContain('<b:with value=\'1\' var=\'outer\'>')
    expect(output).toContain('<b:with value=\'2\' var=\'extra\'>')
    expect(output).toContain('<b:with value=\'3\' var=\'inner\'>')
    expect(output).toContain('<span>nested</span>')

    expect((output.match(/<\/b:with>/g) || []).length).toBe(3)
  })

  it('preserves CDATA blocks containing tags or pseudo-tags', () => {
    const input = `<b:with var:foo='1' var:bar='2'>
      <![CDATA[ <b:with var:ignored='none'> ]]></b:with>`

    const output = expandMultiWith(input)
    expect(output).toContain('<![CDATA[ <b:with var:ignored=\'none\'> ]]>')
    expect(output).toContain('<b:with value=\'1\' var=\'foo\'>')
    expect(output).toContain('<b:with value=\'2\' var=\'bar\'>')
    expect((output.match(/<\/b:with>/g) || []).length).toBe(2)
  })

  it('integrates seamlessly into full processTemplate compilation pipeline', () => {
    const template = `
      <html>
        <body>
          <b:with var:source='data:src' var:avatar='resizeImage(data:source, 40)'>
            <b:include name='@avatar' src='data:avatar' loading='lazy'/>
          </b:with>
        </body>
      </html>
    `
    const output = processTemplate(template)

    expect(output).toContain('<b:with value=\'data:src\' var=\'source\'>')
    expect(output).toContain('<b:with value=\'resizeImage(data:source, 40)\' var=\'avatar\'>')

    expect(output).toContain('<b:include name=\'@avatar\' data=\'{ src: data:avatar, loading: "lazy" }\'/>')
  })

  describe('hierarchical indentation preservation', () => {
    it('preserves base indent and steps each nested <b:with> level and its closing tag with spaces', () => {
      const input = [
        '    <b:with var:a=\'1\' var:b=\'2\' var:c=\'3\'>',
        '      <div>content</div>',
        '    </b:with>',
      ].join('\n')

      const output = expandMultiWith(input)
      const expected = [
        '    <b:with value=\'1\' var=\'a\'>',
        '      <b:with value=\'2\' var=\'b\'>',
        '        <b:with value=\'3\' var=\'c\'>',
        '          <div>content</div>',
        '        </b:with>',
        '      </b:with>',
        '    </b:with>',
      ].join('\n')

      expect(output).toBe(expected)
    })

    it('preserves base indent and steps each nested <b:with> level and its closing tag with tabs', () => {
      const input = [
        '\t\t<b:with var:first=\'1\' var:second=\'2\'>',
        '\t\t\t<span>tabbed</span>',
        '\t\t</b:with>',
      ].join('\n')

      const output = expandMultiWith(input)
      const expected = [
        '\t\t<b:with value=\'1\' var=\'first\'>',
        '\t\t\t<b:with value=\'2\' var=\'second\'>',
        '\t\t\t\t<span>tabbed</span>',
        '\t\t\t</b:with>',
        '\t\t</b:with>',
      ].join('\n')

      expect(output).toBe(expected)
    })

    it('correctly shifts multiline nested child content when expanding multiple variables', () => {
      const input = [
        '  <b:with var:currentTheme=\'skin:theme.uiScheme\' var:isHomePage=\'data:view.isHomepage\' var:maxPosts=\'10\'>',
        '    <div class=\'layout-container\'>',
        '      <aside class=\'theme-info\'></aside>',
        '    </div>',
        '  </b:with>',
      ].join('\n')

      const output = expandMultiWith(input)
      const expected = [
        '  <b:with value=\'skin:theme.uiScheme\' var=\'currentTheme\'>',
        '    <b:with value=\'data:view.isHomepage\' var=\'isHomePage\'>',
        '      <b:with value=\'10\' var=\'maxPosts\'>',
        '        <div class=\'layout-container\'>',
        '          <aside class=\'theme-info\'></aside>',
        '        </div>',
        '      </b:with>',
        '    </b:with>',
        '  </b:with>',
      ].join('\n')

      expect(output).toBe(expected)
    })

    it('preserves single line inline expansion without adding unwanted linebreaks', () => {
      const input = '<b:with var:x=\'10\' var:y=\'20\'><span>inline</span></b:with>'
      const output = expandMultiWith(input)
      expect(output).toBe('<b:with value=\'10\' var=\'x\'><b:with value=\'20\' var=\'y\'><span>inline</span></b:with></b:with>')
    })
  })
})
