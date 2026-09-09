import { describe, expect, it, vi } from 'vitest'
import {
  processTemplate,
  resolveDocumentDefaultMarkups,
} from '../../../lib/templates/blogger-parser.js'

describe('defaultmarkups Global Resolver and Cascade (Phase 6)', () => {
  describe('cascade semantics and console warning', () => {
    it('applies Blogger cascade where later includable definitions overwrite earlier ones', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const input = `<html><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>
              <div>Version A</div>
            </b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <main>Content</main>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>
              <div>Version B</div>
            </b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input)

      expect(output).toContain('<div>Version B</div>')
      expect(output).not.toContain('<div>Version A</div>')
      expect(warnSpy).toHaveBeenCalledWith(
        'The includable "post" in defaultmarkup type="Blog" was redefined and overwritten by a subsequent definition.',
      )

      warnSpy.mockRestore()
    })
  })

  describe('consolidation into first <b:defaultmarkups>', () => {
    it('consolidates all blocks into the first <b:defaultmarkups> and removes subsequent blocks', () => {
      const input = `<html><body>
        <div id='top'>
          <b:defaultmarkups>
            <b:defaultmarkup type='Header'>
              <b:includable id='title'><h1>Site Title</h1></b:includable>
            </b:defaultmarkup>
          </b:defaultmarkups>
        </div>
        <div id='middle'>Middle content</div>
        <div id='bottom'>
          <b:defaultmarkups>
            <b:defaultmarkup type='Header'>
              <b:includable id='description'><p>Site Desc</p></b:includable>
            </b:defaultmarkup>
          </b:defaultmarkups>
        </div>
      </body></html>`

      const output = processTemplate(input)

      // Count occurrences of <b:defaultmarkups>
      const matches = [...output.matchAll(/<b:defaultmarkups>/g)]
      expect(matches.length).toBe(1)

      // The consolidated block is inside #top, not inside #bottom
      const topPart = output.slice(output.indexOf('<div id=\'top\'>'), output.indexOf('<div id=\'middle\'>'))
      expect(topPart).toContain('<b:defaultmarkups>')
      expect(topPart).toContain('<h1>Site Title</h1>')
      expect(topPart).toContain('<p>Site Desc</p>')

      const bottomPart = output.slice(output.indexOf('<div id=\'bottom\'>'))
      expect(bottomPart).not.toContain('<b:defaultmarkups>')
    })
  })

  describe('native markups neutralizations and completion', () => {
    it('neutralizes missing native includables within an explicit defaultmarkup block', () => {
      const input = `<html><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Header'>
            <b:includable id='title'><h1>Only Title</h1></b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input)

      expect(output).toContain('<h1>Only Title</h1>')
      // Native Header includables: behindImageStyle, description, image, title
      expect(output).toContain('<b:includable id=\'behindImageStyle\'/>')
      expect(output).toContain('<b:includable id=\'description\'/>')
      expect(output).toContain('<b:includable id=\'image\'/>')
    })

    it('generates blocks for undeclared native groups like All, Blog, Profile', () => {
      const input = `<html><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Header'>
            <b:includable id='title'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input)

      expect(output).toContain('<b:defaultmarkup type=\'All\'>')
      expect(output).toContain('<b:includable id=\'main\'/>')
      expect(output).toContain('<b:includable id=\'content\'/>')
      expect(output).toContain('<b:defaultmarkup type=\'Subscribe\'>')
      expect(output).toContain('<b:includable id=\'feeds\'/>')
    })
  })

  describe('custom types and custom includables preservation', () => {
    it('preserves custom type="Common" and custom author includables', () => {
      const input = `<html><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Common'>
            <b:includable id='customNav'>
              <nav>Menu</nav>
            </b:includable>
          </b:defaultmarkup>
          <b:defaultmarkup type='Blog'>
            <b:includable id='customAuthorBadge'>
              <span>VIP</span>
            </b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input)

      expect(output).toContain('<b:defaultmarkup type=\'Common\'>')
      expect(output).toContain('<b:includable id=\'customNav\'>')
      expect(output).toContain('<nav>Menu</nav>')
      expect(output).toContain('<b:includable id=\'customAuthorBadge\'>')
      expect(output).toContain('<span>VIP</span>')
    })
  })

  describe('h:resolveMarkups directive and precedence', () => {
    it('disables normalization completely when h:resolveMarkups="false" is present', () => {
      const input = `<html h:resolveMarkups='false'><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version A</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version B</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input)

      // Both blocks are preserved
      const matches = [...output.matchAll(/<b:defaultmarkups>/g)]
      expect(matches.length).toBe(2)
      expect(output).toContain('Version A')
      expect(output).toContain('Version B')
      // h:resolveMarkups is removed from <html>
      expect(output).not.toContain('h:resolveMarkups')
    })

    it('strips h:resolveMarkups from <html> when enabled', () => {
      const input = `<html h:resolveMarkups='true'><body><b:defaultmarkups><b:defaultmarkup type='Header'><b:includable id='title'/></b:defaultmarkup></b:defaultmarkups></body></html>`
      const output = processTemplate(input)
      expect(output).not.toContain('h:resolveMarkups')
    })

    it('disables normalization when config has resolveMarkups: false and no root directive is present', () => {
      const input = `<html><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version A</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version B</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input, { hamlet: { resolveMarkups: false } })

      const matches = [...output.matchAll(/<b:defaultmarkups>/g)]
      expect(matches.length).toBe(2)
      expect(output).toContain('Version A')
      expect(output).toContain('Version B')
    })

    it('root directive h:resolveMarkups="true" overrides config resolveMarkups: false', () => {
      const input = `<html h:resolveMarkups='true'><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version A</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version B</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input, { hamlet: { resolveMarkups: false } })

      const matches = [...output.matchAll(/<b:defaultmarkups>/g)]
      expect(matches.length).toBe(1)
      expect(output).toContain('Version B')
      expect(output).not.toContain('h:resolveMarkups')
    })

    it('root directive h:resolveMarkups="false" overrides config resolveMarkups: true', () => {
      const input = `<html h:resolveMarkups='false'><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version A</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version B</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input, { hamlet: { resolveMarkups: true } })

      const matches = [...output.matchAll(/<b:defaultmarkups>/g)]
      expect(matches.length).toBe(2)
      expect(output).toContain('Version A')
      expect(output).toContain('Version B')
      expect(output).not.toContain('h:resolveMarkups')
    })

    it('bare h:resolveMarkups attribute on <html> acts as enabled and overrides config resolveMarkups: false', () => {
      const input = `<html h:resolveMarkups><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version A</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
        <b:defaultmarkups>
          <b:defaultmarkup type='Blog'>
            <b:includable id='post'>Version B</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input, { hamlet: { resolveMarkups: false } })

      const matches = [...output.matchAll(/<b:defaultmarkups>/g)]
      expect(matches.length).toBe(1)
      expect(output).toContain('Version B')
      expect(output).not.toContain('h:resolveMarkups')
    })
  })

  describe('edge cases', () => {
    it('leaves templates without <b:defaultmarkups> untouched', () => {
      const input = `<html><body><main>Plain theme</main></body></html>`
      const output = processTemplate(input)
      expect(output).not.toContain('<b:defaultmarkups')
    })

    it('preserves CDATA inside includables intact', () => {
      const input = `<html><body>
        <b:defaultmarkups>
          <b:defaultmarkup type='All'>
            <b:includable id='main'>
              <![CDATA[<div>Raw & Special <> Characters</div>]]>
            </b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input)
      expect(output).toContain('<![CDATA[<div>Raw & Special <> Characters</div>]]>')
    })

    it('returns untouched input when resolveDocumentDefaultMarkups is called directly with empty/invalid input', () => {
      expect(resolveDocumentDefaultMarkups('<div>test</div>')).toBe('<div>test</div>')
      expect(resolveDocumentDefaultMarkups(null)).toBe(null)
    })
  })

  describe('real world simulation: laertes.xml cascade', () => {
    it('consolidates header and footer defaultmarkups with All override into single clean structure', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const input = `<html><body>
        <!-- Header defaultmarkups (L330) -->
        <b:defaultmarkups>
          <b:defaultmarkup type='All'>
            <b:includable id='main'/>
            <b:includable id='content'/>
          </b:defaultmarkup>
          <b:defaultmarkup type='Common'>
            <b:includable id='postBody'>Article</b:includable>
          </b:defaultmarkup>
        </b:defaultmarkups>

        <b:section id='main-section'/>

        <!-- Footer defaultmarkups (L2011) overriding All -->
        <b:defaultmarkups>
          <b:defaultmarkup type='All'>
            <b:includable id='main'>
              <div class='widget-content'>
                <b:include name='content'/>
              </div>
            </b:includable>
            <b:includable id='content'/>
          </b:defaultmarkup>
        </b:defaultmarkups>
      </body></html>`

      const output = processTemplate(input)

      // Exactly one <b:defaultmarkups> block
      const count = [...output.matchAll(/<b:defaultmarkups>/g)].length
      expect(count).toBe(1)

      // The active 'All.main' is the overridden footer version
      expect(output).toContain('<div class=\'widget-content\'>')
      expect(output).toContain('<b:include name=\'content\'/>')

      // Common is retained
      expect(output).toContain('<b:defaultmarkup type=\'Common\'>')
      expect(output).toContain('Article')

      warnSpy.mockRestore()
    })
  })

  describe('self-closing and indentation formatting', () => {
    it('activates and generates neutralizations with self-closing <b:defaultmarkups/>', () => {
      const input = `<html><body>
        <b:defaultmarkups/>
      </body></html>`

      const output = processTemplate(input)

      expect(output).toContain('<b:defaultmarkups>')
      expect(output).toContain('</b:defaultmarkups>')
      expect(output).toContain('<b:defaultmarkup type=\'All\'>')
      expect(output).toContain('<b:includable id=\'main\'/>')
      expect(output).toContain('<b:includable id=\'content\'/>')
    })

    it('respects base indentation and indents children proportionally', () => {
      const input = `<html>
  <body>
    <b:defaultmarkups>
      <b:defaultmarkup type='All'>
        <b:includable id='main' var='this'>
          <b:include name='widget-title'/>
          <b:include name='content'/>
        </b:includable>
      </b:defaultmarkup>
    </b:defaultmarkups>
  </body>
</html>`

      const output = processTemplate(input)

      // Base indent is 4 spaces
      expect(output).toContain('    <b:defaultmarkups>')
      expect(output).toContain('      <b:defaultmarkup type=\'All\'>')
      expect(output).toContain('        <b:includable id=\'main\' var=\'this\'>')
      expect(output).toContain('          <b:include name=\'widget-title\'/>')
      expect(output).toContain('          <b:include name=\'content\'/>')
      expect(output).toContain('        </b:includable>')
      expect(output).toContain('      </b:defaultmarkup>')
      expect(output).toContain('    </b:defaultmarkups>')
    })
  })
})
