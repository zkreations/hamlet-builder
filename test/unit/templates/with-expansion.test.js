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

    // Verify 3 matching closing tags
    const closeCount = (output.match(/<\/b:with>/g) || []).length
    expect(closeCount).toBe(3)

    // Verify order of open tags
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

    // 2 for outer + 1 for inner = 3 closing tags
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

    // Check with expansion
    expect(output).toContain('<b:with value=\'data:src\' var=\'source\'>')
    expect(output).toContain('<b:with value=\'resizeImage(data:source, 40)\' var=\'avatar\'>')

    // Check include attributes expansion from Fase 1 still works seamlessly together
    expect(output).toContain('<b:include name=\'@avatar\' data=\'{ src: data:avatar, loading: "lazy" }\'/>')
  })
})
