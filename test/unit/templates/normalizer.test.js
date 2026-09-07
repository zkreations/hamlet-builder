import { describe, expect, it } from 'vitest'
import {
  normalizeBloggerExpressions,
  normalizeBloggerTag,
  normalizeExprAttributes,
} from '../../../lib/templates/normalizer.js'

describe('blogger normalizer', () => {
  describe('normalizeExprAttributes', () => {
    it('normalizes multiline expr:* attributes on HTML elements into single line', () => {
      const input = `<div expr:class='
        data:view.isHomepage
          ? "home"
          : data:view.isPost
            ? "single"
            : "other"
      '></div>`
      const output = normalizeExprAttributes(input)
      expect(output).toBe('<div expr:class=\'data:view.isHomepage ? "home" : data:view.isPost ? "single" : "other"\'></div>')
    })

    it('normalizes multiline expr:* attributes with double quotes', () => {
      const input = `<span expr:title="
        data:post.hasTitle
          ? 'Post: ' + data:post.title
          : 'No title'
      "></span>`
      const output = normalizeExprAttributes(input)
      expect(output).toBe('<span expr:title="data:post.hasTitle ? \'Post: \' + data:post.title : \'No title\'"></span>')
    })

    it('preserves non-Blogger multiline HTML attributes intact', () => {
      const input = `<div title="
        First Line
        Second Line
      " data-custom="
        multiline
      "></div>`
      const output = normalizeExprAttributes(input)
      expect(output).toBe(input)
    })

    it('preserves expressions inside CDATA blocks and script/style tags', () => {
      const input = `<b:skin><![CDATA[
        /* expr:class='inside CDATA is preserved' */
        body { color: red; }
      ]]></b:skin>
      <script>
        const str = "expr:class='inside script is preserved'";
      </script>`
      const output = normalizeExprAttributes(input)
      expect(output).toBe(input)
    })

    it('preserves self-closing void elements with expr:* attributes', () => {
      const input = `<img
        expr:src='
          data:post.featuredImage
        '
        alt='Thumbnail'
      />`
      const output = normalizeExprAttributes(input)
      expect(output).toContain('expr:src=\'data:post.featuredImage\'')
      expect(output).toContain('/>')
    })
  })

  describe('normalizeBloggerTag', () => {
    it('normalizes cond in b:if and collapses tag spacing', () => {
      const input = `if   cond='
        data:view.isPost
          and (data:post.hasTitle or data:blog.pageType == "index")
      ' >`
      const output = normalizeBloggerTag(input)
      expect(output).toBe('if cond=\'data:view.isPost and (data:post.hasTitle or data:blog.pageType == "index")\' >')
    })

    it('normalizes values in b:loop with lambda filters', () => {
      const input = `loop
        values='
          data:posts
            filter (p => p.hasTitle and not p.isDraft)
        '
        var='post'>`
      const output = normalizeBloggerTag(input)
      expect(output).toBe('loop values=\'data:posts filter (p => p.hasTitle and not p.isDraft)\' var=\'post\'>')
    })

    it('normalizes expr in b:eval', () => {
      const input = `eval
        expr='
          data:post.allowComments
            ? data:post.commentCount
            : "Disabled"
        '/>`
      const output = normalizeBloggerTag(input)
      expect(output).toBe('eval expr=\'data:post.allowComments ? data:post.commentCount : "Disabled"\'/>')
    })

    it('normalizes value in b:with', () => {
      const input = `with
        value='
          data:post.labels
            filter (l => l.name != "featured")
        '
        var='labels'></b:with>`
      const output = normalizeBloggerTag(input)
      expect(output).toBe('with value=\'data:post.labels filter (l => l.name != "featured")\' var=\'labels\'></b:with>')
    })
  })

  describe('normalizeBloggerExpressions', () => {
    it('normalizes both expr:* and b: tag control expressions', () => {
      const input = `<b:if cond='
        data:view.isPost
      '><div expr:class='
        data:post.id
      '></div></b:if>`
      const output = normalizeBloggerExpressions(input)
      expect(output).toBe('<b:if cond=\'data:view.isPost\'><div expr:class=\'data:post.id\'></div></b:if>')
    })
  })
})
