import { describe, expect, it, vi } from 'vitest'
import { normalizeBloggerExpressions, processTemplate } from '../../../lib/templates/blogger-parser.js'

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

    it('falls back to HTML type when invalid widget type is supplied', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const input = '<html><body><b:widget type="NonExistentWidget"/></body></html>'
      const output = processTemplate(input)
      expect(output).toContain('type=\'HTML\'')
      expect(output).toContain('id=\'HTML1\'')
      vi.restoreAllMocks()
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

    it('injects default attribute for non-string variable types', () => {
      const input = '<html><Variable name="mainBg" type="background" value="#ffffff"/></html>'
      const output = processTemplate(input)
      expect(output).toContain('name="mainBg"')
      expect(output).toContain('type="background"')
      expect(output).toContain('default="#ffffff"')
    })

    it('throws error if Variable element lacks name attribute', () => {
      const input = '<html><Variable value="#ff0000"/></html>'
      expect(() => processTemplate(input)).toThrow('The name attribute is required for the Variable element.')
    })
  })

  describe('normalizeBloggerExpressions', () => {
    it('normalizes multiline expr:* attributes on HTML elements into single line', () => {
      const input = `<div expr:class='
        data:view.isHomepage
          ? "home"
          : data:view.isPost
            ? "single"
            : "other"
      '></div>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe('<div expr:class=\'data:view.isHomepage ? "home" : data:view.isPost ? "single" : "other"\'></div>')
    })

    it('normalizes multiline expr:* attributes with double quotes and mixed internal quotes', () => {
      const input = `<span expr:title="
        data:post.hasTitle
          ? 'Post: ' + data:post.title
          : 'No title'
      "></span>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe('<span expr:title="data:post.hasTitle ? \'Post: \' + data:post.title : \'No title\'"></span>')
    })

    it('normalizes multiline cond attribute on b:if and b:elseif tags', () => {
      const input = `<b:if cond='
        data:view.isPost
          and (data:post.hasTitle or data:blog.pageType == "index")
      '><h1>Title</h1></b:if>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe('<b:if cond=\'data:view.isPost and (data:post.hasTitle or data:blog.pageType == "index")\'><h1>Title</h1></b:if>')
    })

    it('normalizes multiline values attribute with lambda filters on b:loop', () => {
      const input = `<b:loop values='
        data:posts
          filter (p => p.hasTitle and not p.isDraft)
      ' var='post'></b:loop>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe('<b:loop values=\'data:posts filter (p => p.hasTitle and not p.isDraft)\' var=\'post\'></b:loop>')
    })

    it('normalizes multiline expr attribute on b:eval', () => {
      const input = `<b:eval expr='
        data:post.allowComments
          ? data:post.commentCount
          : "Disabled"
      '/>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe('<b:eval expr=\'data:post.allowComments ? data:post.commentCount : "Disabled"\'/>')
    })

    it('normalizes multiline value attribute on b:with', () => {
      const input = `<b:with value='
        data:post.labels
          filter (l => l.name != "featured")
      ' var='labels'></b:with>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe('<b:with value=\'data:post.labels filter (l => l.name != "featured")\' var=\'labels\'></b:with>')
    })

    it('preserves non-Blogger multiline HTML attributes intact', () => {
      const input = `<div title="
        First Line
        Second Line
      " data-custom="
        multiline
      "></div>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe(input)
    })

    it('preserves expressions inside CDATA blocks and script/style tags intact', () => {
      const input = `<b:skin><![CDATA[
        /* expr:class='inside CDATA is preserved' */
        body { color: red; }
      ]]></b:skin>
      <script>
        const str = "expr:class='inside script is preserved'";
      </script>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe(input)
    })

    it('preserves self-closing void elements with expr:* attributes', () => {
      const input = `<img
        expr:src='
          data:post.featuredImage
        '
        alt='Thumbnail'
      />`
      const output = normalizeBloggerExpressions(input)
      expect(output).toContain('expr:src=\'data:post.featuredImage\'')
      expect(output).toContain('/>')
    })

    it('integrates seamlessly inside processTemplate full pipeline', () => {
      const input = `<html><body><a
        class='btn'
        expr:href='
          data:post.hasJumpLink
            ? data:post.url
            : data:post.link
        '
      ><img src="pic.jpg"></a></body></html>`
      const output = processTemplate(input)
      expect(output).toContain('expr:href=\'data:post.hasJumpLink ? data:post.url : data:post.link\'')
      expect(output).toContain('<img src="pic.jpg"/>')
      expect(output).toContain('b:css=\'false\'')
    })
  })
})
