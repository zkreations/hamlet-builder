import { describe, expect, it } from 'vitest'
import {
  collectDocumentDefaultMarkups,
  expandWidgetIncludables,
  getNativeMarkupsForType,
  isCleanInDefaultMarkups,
  normalizeBooleanAttributes,
  processTemplate,
  resolveWidgetIncludables,
} from '../../../lib/templates/blogger-parser.js'

describe('widget Includables System (Phase 4)', () => {
  describe('getNativeMarkupsForType', () => {
    it('resolves All markups for any widget', () => {
      const markups = getNativeMarkupsForType('LinkList')
      expect(markups.has('main')).toBe(true)
      expect(markups.has('content')).toBe(true)
    })

    it('resolves specific markups for Header', () => {
      const markups = getNativeMarkupsForType('Header')
      expect(markups.has('main')).toBe(true)
      expect(markups.has('content')).toBe(true)
      expect(markups.has('title')).toBe(true)
      expect(markups.has('description')).toBe(true)
      expect(markups.has('image')).toBe(true)
      expect(markups.has('behindImageStyle')).toBe(true)
    })

    it('resolves comma-separated grouped widget types like Blog', () => {
      const markups = getNativeMarkupsForType('Blog')
      expect(markups.has('defaultAdUnit')).toBe(true)
      expect(markups.has('postAuthor')).toBe(true)
      expect(markups.has('comments')).toBe(true)
    })
  })

  describe('collectDocumentDefaultMarkups', () => {
    it('collects includables from multiple b:defaultmarkups blocks', () => {
      const xml = `
        <b:defaultmarkups>
          <b:defaultmarkup type='All'>
            <b:includable id='main'/>
            <b:includable id='content'/>
          </b:defaultmarkup>
          <b:defaultmarkup type='LinkList'>
            <b:includable id='list'/>
            <b:includable id='item'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog,PopularPosts'>
            <b:includable id='customSnippet'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
      `
      const map = collectDocumentDefaultMarkups(xml)
      expect(map.get('All').has('main')).toBe(true)
      expect(map.get('All').has('content')).toBe(true)
      expect(map.get('LinkList').has('list')).toBe(true)
      expect(map.get('LinkList').has('item')).toBe(true)
      expect(map.get('Blog').has('customSnippet')).toBe(true)
      expect(map.get('PopularPosts').has('customSnippet')).toBe(true)
    })

    it('strictly treats only self-closing includables as clean', () => {
      const xml = `
        <b:defaultmarkups>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='selfClosing'/>
            <b:includable id='emptyBlock'></b:includable>
            <b:includable id='whitespaceBlock'>   \n   </b:includable>
            <b:includable id='commentBlock'><!-- only comment --></b:includable>
            <b:includable id='contentBlock'><div>actual markup</div></b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      `
      const map = collectDocumentDefaultMarkups(xml)
      expect(isCleanInDefaultMarkups('selfClosing', 'Subscribe', map)).toBe(true)
      expect(isCleanInDefaultMarkups('emptyBlock', 'Subscribe', map)).toBe(false)
      expect(isCleanInDefaultMarkups('whitespaceBlock', 'Subscribe', map)).toBe(false)
      expect(isCleanInDefaultMarkups('commentBlock', 'Subscribe', map)).toBe(false)
      expect(isCleanInDefaultMarkups('contentBlock', 'Subscribe', map)).toBe(false)
    })

    it('falls back to All when widgetType does not define the includable', () => {
      const xml = `
        <b:defaultmarkups>
          <b:defaultmarkup type='All'>
            <b:includable id='globalClean'/>
            <b:includable id='globalDirty'><div>content</div></b:includable>
          </b:defaultmarkup>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='feeds'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
      `
      const map = collectDocumentDefaultMarkups(xml)
      expect(isCleanInDefaultMarkups('globalClean', 'Subscribe', map)).toBe(true)
      expect(isCleanInDefaultMarkups('globalDirty', 'Subscribe', map)).toBe(false)
      expect(isCleanInDefaultMarkups('feeds', 'Subscribe', map)).toBe(true)
      expect(isCleanInDefaultMarkups('nonExistent', 'Subscribe', map)).toBe(false)
    })

    it('prioritizes widget-specific definition over All', () => {
      const xml = `
        <b:defaultmarkups>
          <b:defaultmarkup type='All'>
            <b:includable id='main'/>
            <b:includable id='content'><div>Dirty in All</div></b:includable>
          </b:defaultmarkup>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='main'><div>Dirty in Subscribe</div></b:includable>
            <b:includable id='content'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
      `
      const map = collectDocumentDefaultMarkups(xml)
      // For Subscribe, specific type overrides All
      expect(isCleanInDefaultMarkups('main', 'Subscribe', map)).toBe(false)
      expect(isCleanInDefaultMarkups('content', 'Subscribe', map)).toBe(true)
      // For other widget types, All applies
      expect(isCleanInDefaultMarkups('main', 'LinkList', map)).toBe(true)
      expect(isCleanInDefaultMarkups('content', 'LinkList', map)).toBe(false)
    })

    it('respects Blogger cascade across multiple b:defaultmarkups blocks (last definition wins)', () => {
      const xml = `
        <b:defaultmarkups>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='feeds'><div>Initially dirty</div></b:includable>
            <b:includable id='item'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <!-- Second block later in template -->
        <b:defaultmarkups>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='feeds'/>
            <b:includable id='item'><div>Became dirty</div></b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      `
      const map = collectDocumentDefaultMarkups(xml)
      expect(isCleanInDefaultMarkups('feeds', 'Subscribe', map)).toBe(true)
      expect(isCleanInDefaultMarkups('item', 'Subscribe', map)).toBe(false)
    })
  })

  describe('resolveWidgetIncludables', () => {
    it('merges native markups and theme defaultmarkups', () => {
      const themeMap = new Map([
        ['All', new Set(['themeGlobal'])],
        ['LinkList', new Set(['list', 'customItem'])],
      ])
      const resolved = resolveWidgetIncludables('LinkList', themeMap)
      expect(resolved.has('main')).toBe(true)
      expect(resolved.has('content')).toBe(true)
      expect(resolved.has('themeGlobal')).toBe(true)
      expect(resolved.has('list')).toBe(true)
      expect(resolved.has('customItem')).toBe(true)
    })
  })

  describe('expandWidgetIncludables', () => {
    it('returns untouched input when template lacks widget tags or is invalid', () => {
      expect(expandWidgetIncludables('<div>plain</div>')).toBe('<div>plain</div>')
      expect(expandWidgetIncludables(null)).toBe(null)
    })
  })

  describe('normalizeBooleanAttributes', () => {
    it('normalizes locked and visible without value to true', () => {
      expect(normalizeBooleanAttributes('type=\'LinkList\' locked visible')).toBe(
        'type=\'LinkList\' locked=\'true\' visible=\'true\'',
      )
    })

    it('preserves explicit false values', () => {
      expect(normalizeBooleanAttributes('type=\'LinkList\' locked=\'false\'')).toBe(
        'type=\'LinkList\' locked=\'false\'',
      )
    })

    it('leaves attributes untouched when absent', () => {
      expect(normalizeBooleanAttributes('type=\'LinkList\'')).toBe('type=\'LinkList\'')
    })
  })

  describe('clean widget generation with override:*', () => {
    it('expands override:main on self-closing widget and neutralizes remaining includables', () => {
      const input = `<html><body><b:section id='s'><b:widget type='LinkList' title='Social' override:main='custom_main'/></b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:includable id=\'main\'>')
      expect(output).toContain('<b:include name=\'custom_main\'/>')
      expect(output).toContain('</b:includable>')
      expect(output).toContain('<b:includable id=\'content\'/>')
      expect(output).not.toContain('override:main')
    })

    it('supports multiple override:* attributes on the same widget', () => {
      const input = `<html><body><b:section id='s'><b:widget type='LinkList' override:main='custom_main' override:content='custom_content'/></b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:includable id=\'main\'>\n    <b:include name=\'custom_main\'/>\n  </b:includable>')
      expect(output).toContain('<b:includable id=\'content\'>\n    <b:include name=\'custom_content\'/>\n  </b:includable>')
    })

    it('supports override:* for arbitrary includable names', () => {
      const input = `<html><body><b:section id='s'><b:widget type='HTML' override:myCustomSnippet='foo_bar'/></b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:includable id=\'myCustomSnippet\'>\n    <b:include name=\'foo_bar\'/>\n  </b:includable>')
      // Also neutralizes native markups of HTML ('main' and 'content')
      expect(output).toContain('<b:includable id=\'main\'/>')
      expect(output).toContain('<b:includable id=\'content\'/>')
    })

    it('only neutralizes includables in the widget when they are NOT clean in b:defaultmarkups', () => {
      const input = `<html>
        <b:defaultmarkups>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='feeds'>
              <div class='subscribe-links'>
                <a expr:href='data:blog.feedLinks' target='_blank'>Suscribirse al feed</a>
              </div>
            </b:includable>
            <b:includable id='cleanSnippet'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <body><b:section id='s'>
          <b:widget type='Subscribe' id='Sub1' override:main='custom_main'/>
        </b:section></body>
      </html>`
      const output = processTemplate(input)
      const widgetContent = output.match(/<b:widget\b[^>]+id='Sub1'[^>]*>([\s\S]*?)<\/b:widget>/)?.[1] ?? ''

      // 'main' is overridden
      expect(widgetContent).toContain('<b:includable id=\'main\'>\n              <b:include name=\'custom_main\'/>\n            </b:includable>')
      // 'feeds' has content in defaultmarkups, so it MUST be neutralized in widget
      expect(widgetContent).toContain('<b:includable id=\'feeds\'/>')
      // 'cleanSnippet' is self-closing in defaultmarkups, so it MUST NOT be duplicated in widget
      expect(widgetContent).not.toContain('<b:includable id=\'cleanSnippet\'/>')
      // 'content' (from All) was cleanly generated in defaultmarkups, so it MUST NOT be in widget
      expect(widgetContent).not.toContain('<b:includable id=\'content\'/>')
    })

    it('does not inject any neutralized includables when all unhandled includables are clean in b:defaultmarkups', () => {
      const input = `<html>
        <b:defaultmarkups>
          <b:defaultmarkup type='LinkList'>
            <b:includable id='list'/>
            <b:includable id='item'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <body><b:section id='s'>
          <b:widget type='LinkList' id='LinkList1' override:main='custom_main'/>
        </b:section></body>
      </html>`
      const output = processTemplate(input)
      const widgetContent = output.match(/<b:widget\b[^>]+id='LinkList1'[^>]*>([\s\S]*?)<\/b:widget>/)?.[1] ?? ''

      expect(widgetContent).toContain('<b:includable id=\'main\'>\n              <b:include name=\'custom_main\'/>\n            </b:includable>')
      expect(widgetContent).not.toContain('<b:includable id=\'content\'/>')
      expect(widgetContent).not.toContain('<b:includable id=\'list\'/>')
      expect(widgetContent).not.toContain('<b:includable id=\'item\'/>')
    })

    it('neutralizes an includable when the last definition in b:defaultmarkups (placed after widgets) is not self-closing', () => {
      const input = `<html>
        <b:defaultmarkups>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='feeds'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <body><b:section id='s'>
          <b:widget type='Subscribe' id='Sub1' override:main='custom_main'/>
        </b:section></body>
        <!-- Second block placed at the end of the template overriding 'feeds' with content -->
        <b:defaultmarkups>
          <b:defaultmarkup type='Subscribe'>
            <b:includable id='feeds'><div class='trailing'>Dirty definition</div></b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </html>`
      const output = processTemplate(input)
      const widgetContent = output.match(/<b:widget\b[^>]+id='Sub1'[^>]*>([\s\S]*?)<\/b:widget>/)?.[1] ?? ''

      expect(widgetContent).toContain('<b:includable id=\'main\'>\n              <b:include name=\'custom_main\'/>\n            </b:includable>')
      // Since the last definition in the document was not self-closing, it must be neutralized in the widget
      expect(widgetContent).toContain('<b:includable id=\'feeds\'/>')
    })

    it('preserves explicitly defined includables and neutralizes the rest', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget type='LinkList' override:main='custom_main'>
          <b:includable id='content'>
            <div class='custom-content'>Static</div>
          </b:includable>
        </b:widget>
      </b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:includable id=\'main\'>\n            <b:include name=\'custom_main\'/>\n          </b:includable>')
      expect(output).toContain('<div class=\'custom-content\'>Static</div>')
      expect(output).not.toContain('<b:includable id=\'content\'/>')
    })

    it('throws compile error on ambiguous conflict between override:<id> and explicit <b:includable id="<id>">', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget type='LinkList' id='LinkList1' override:main='custom_main'>
          <b:includable id='main'>
            <div>Duplicate</div>
          </b:includable>
        </b:widget>
      </b:section></body></html>`
      expect(() => processTemplate(input)).toThrow(
        'Ambiguous includable definition: Widget "LinkList1" specifies "override:main" as an attribute and also contains an explicit "<b:includable id=\'main\'>" element.',
      )
    })

    it('strictly preserves <b:widget-settings> at the beginning of the widget', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget type='HTML' title='Copyright' override:main='widget:HTML_Copyright'>
          <b:widget-settings>
            <b:widget-setting name='content'><![CDATA[Developed by zkreations]]></b:widget-setting>
          </b:widget-settings>
        </b:widget>
      </b:section></body></html>`
      const output = processTemplate(input)

      const settingsIndex = output.indexOf('<b:widget-settings>')
      const mainIndex = output.indexOf('<b:includable id=\'main\'>')
      expect(settingsIndex).toBeGreaterThan(-1)
      expect(mainIndex).toBeGreaterThan(-1)
      expect(settingsIndex).toBeLessThan(mainIndex)
      expect(output).toContain('Developed by zkreations')
      expect(output).toContain('<b:includable id=\'content\'/>')
    })
  })

  describe('auto-wrapping of direct content', () => {
    it('wraps direct HTML content into <b:includable id="main"> and activates clean mode', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget type='HTML' title='Banner'>
          <div class='banner'>
            <a href='/promo'>Offer</a>
          </div>
        </b:widget>
      </b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:includable id=\'main\'>')
      expect(output).toContain('<div class=\'banner\'>')
      expect(output).toContain('<a href=\'/promo\'>Offer</a>')
      expect(output).toContain('</div>')
      expect(output).toContain('<b:includable id=\'content\'/>')
    })

    it('wraps direct <b:include> into <b:includable id="main">', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget type='LinkList' title='Social Networks'>
          <b:include name='widget:LinkList_SocialNetworks'/>
        </b:widget>
      </b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:includable id=\'main\'>')
      expect(output).toContain('<b:include name=\'widget:LinkList_SocialNetworks\'/>')
      expect(output).toContain('<b:includable id=\'content\'/>')
    })

    it('preserves clean relative indentation when auto-wrapping direct content with comments', () => {
      const input = [
        '    <b:widget type=\'Blog\' id=\'Blog1\' title=\'Blog Posts\' override:post=\'customPostTitle\' locked>',
        '      <!-- Contenido directo: se envuelve automaticamente en includable id=\'main\' -->',
        '      <div class=\'blog-posts-wrapper\'>',
        '        <b:include name=\'post\'/>',
        '      </div>',
        '    </b:widget>',
      ].join('\n')

      const output = expandWidgetIncludables(input)

      expect(output).toContain([
        '      <b:includable id=\'main\'>',
        '        <!-- Contenido directo: se envuelve automaticamente en includable id=\'main\' -->',
        '        <div class=\'blog-posts-wrapper\'>',
        '          <b:include name=\'post\'/>',
        '        </div>',
        '      </b:includable>',
      ].join('\n'))
    })

    it('throws compile error if widget has explicit main AND direct content outside includables', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget type='HTML' id='HTML1'>
          <div>Direct Content</div>
          <b:includable id='main'>
            <div>Explicit Main</div>
          </b:includable>
        </b:widget>
      </b:section></body></html>`
      expect(() => processTemplate(input)).toThrow(
        'Ambiguous content: Widget "HTML1" has an explicit "<b:includable id=\'main\'>" and also direct content outside of any includable.',
      )
    })
  })

  describe('preservation of traditional and self-closing widgets', () => {
    it('preserves self-closing widgets without override:*', () => {
      const input = `<html><body><b:section id='s'><b:widget type='Header'/></b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:widget id=\'Header1\' type=\'Header\' version=\'2\'/>')
      expect(output).not.toContain('<b:includable')
    })

    it('preserves traditional widgets with explicit includables', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget id='Blog1' type='Blog'>
          <b:includable id='postMetadataJSONImage'>
            <span>Image</span>
          </b:includable>
        </b:widget>
      </b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:widget id=\'Blog1\' type=\'Blog\' version=\'2\'>')
      expect(output).toContain('<b:includable id=\'postMetadataJSONImage\'>')
      expect(output).not.toContain('<b:includable id=\'main\'/>')
    })

    it('normalizes boolean attributes like locked and visible on traditional widgets', () => {
      const input = `<html><body><b:section id='s'>
        <b:widget id='Header1' type='Header' locked visible/>
      </b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('locked=\'true\'')
      expect(output).toContain('visible=\'true\'')
    })
  })

  describe('real-world patterns from basico.xml and laertes.xml', () => {
    it('compiles simplified LinkList widget identically to Blogger requirement', () => {
      const input = `<html><body><b:section id='footer'>
        <b:widget type='LinkList' title='Social Networks' override:main='widget:LinkList_SocialNetworks' locked/>
      </b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:widget id=\'LinkList1\' type=\'LinkList\' title=\'Social Networks\' locked=\'true\' version=\'2\'>')
      expect(output).toContain('<b:includable id=\'main\'>\n            <b:include name=\'widget:LinkList_SocialNetworks\'/>\n          </b:includable>')
      expect(output).toContain('<b:includable id=\'content\'/>')
    })

    it('compiles simplified HTML widget with settings and override:main', () => {
      const input = `<html><body><b:section id='footer'>
        <b:widget type='HTML' title='Copyright' override:main='widget:HTML_Copyright' locked>
          <b:widget-settings>
            <b:widget-setting name='content'><![CDATA[Developed by <a href="https://zkreations.com">zkreations</a>]]></b:widget-setting>
          </b:widget-settings>
        </b:widget>
      </b:section></body></html>`
      const output = processTemplate(input)

      expect(output).toContain('<b:widget id=\'HTML1\' type=\'HTML\' title=\'Copyright\' locked=\'true\' version=\'2\'>')
      expect(output).toContain('<b:widget-settings>')
      expect(output).toContain('Developed by <a href="https://zkreations.com">zkreations</a>')
      expect(output).toContain('<b:includable id=\'main\'>\n            <b:include name=\'widget:HTML_Copyright\'/>\n          </b:includable>')
      expect(output).toContain('<b:includable id=\'content\'/>')
    })
  })

  describe('hierarchical indentation preservation', () => {
    it('preserves 4 spaces base indent for clean widget generation', () => {
      const input = [
        '<html><body><b:section id=\'s\'>',
        '    <b:widget type=\'LinkList\' override:main=\'custom_main\'/>',
        '</b:section></body></html>',
      ].join('\n')

      const output = processTemplate(input)

      expect(output).toContain('    <b:widget id=\'LinkList1\' type=\'LinkList\' version=\'2\'>\n      <b:includable id=\'main\'>\n        <b:include name=\'custom_main\'/>\n      </b:includable>\n      <b:includable id=\'content\'/>\n    </b:widget>')
    })

    it('preserves tab indentation for direct content auto-wrapping', () => {
      const input = [
        '<html><body><b:section id=\'s\'>',
        '\t\t<b:widget type=\'HTML\'>',
        '\t\t\t<div class=\'foo\'>bar</div>',
        '\t\t</b:widget>',
        '</b:section></body></html>',
      ].join('\n')

      const output = processTemplate(input)

      expect(output).toContain('\t\t<b:widget id=\'HTML1\' type=\'HTML\' version=\'2\'>\n\t\t\t<b:includable id=\'main\'>\n\t\t\t\t<div class=\'foo\'>bar</div>\n\t\t\t</b:includable>\n\t\t\t<b:includable id=\'content\'/>\n\t\t</b:widget>')
    })
  })
})
