import { describe, expect, it } from 'vitest'
import {
  detectBaseIndent,
  detectStepIndent,
  formatNestedBlock,
  indentBlock,
  reindentBlock,
  shiftIndent,
  stripIndent,
} from '../../../lib/utils/indent.js'

describe('indent utilities', () => {
  describe('detectStepIndent', () => {
    it('returns fallback if source is falsy or blank', () => {
      expect(detectStepIndent(null)).toBe('  ')
      expect(detectStepIndent('')).toBe('  ')
      expect(detectStepIndent('   \n  \t  ')).toBe('  ')
      expect(detectStepIndent('', '    ')).toBe('    ')
    })

    it('detects 2 spaces step from deltas', () => {
      const source = [
        '<div>',
        '  <p>',
        '    <span>test</span>',
        '  </p>',
        '</div>',
      ].join('\n')
      expect(detectStepIndent(source)).toBe('  ')
    })

    it('detects 4 spaces step from deltas', () => {
      const source = [
        '<div>',
        '    <section>',
        '        <div>',
        '            <p>content</p>',
        '        </div>',
        '    </section>',
        '</div>',
      ].join('\n')
      expect(detectStepIndent(source)).toBe('    ')
    })

    it('detects tabs when tabs are predominant', () => {
      const source = [
        '<div>',
        '\t<section>',
        '\t\t<p>content</p>',
        '\t</section>',
        '</div>',
      ].join('\n')
      expect(detectStepIndent(source)).toBe('\t')
    })
  })

  describe('detectBaseIndent', () => {
    it('returns empty indent if source is null or index is 0', () => {
      expect(detectBaseIndent(null, 0)).toEqual({ baseIndent: '', stepIndent: '  ' })
      expect(detectBaseIndent('foo', 0)).toEqual({ baseIndent: '', stepIndent: '  ' })
    })

    it('detects spaces as baseIndent and chooses 2 spaces as stepIndent', () => {
      const source = 'line 1\n    <tag>'
      const index = source.indexOf('<tag>')
      expect(detectBaseIndent(source, index)).toEqual({
        baseIndent: '    ',
        stepIndent: '  ',
      })
    })

    it('detects tabs as baseIndent and chooses tab as stepIndent', () => {
      const source = 'line 1\n\t\t<tag>'
      const index = source.indexOf('<tag>')
      expect(detectBaseIndent(source, index)).toEqual({
        baseIndent: '\t\t',
        stepIndent: '\t',
      })
    })

    it('returns empty baseIndent if non-whitespace precedes index on same line', () => {
      const source = '<div>  <tag>'
      const index = source.indexOf('<tag>')
      expect(detectBaseIndent(source, index)).toEqual({
        baseIndent: '',
        stepIndent: '  ',
      })
    })

    it('accurately detects stepIndent using lookahead to child line', () => {
      const source2Spaces = [
        '  <b:with var:a=\'1\'>',
        '    <div>content</div>',
        '  </b:with>',
      ].join('\n')
      expect(detectBaseIndent(source2Spaces, source2Spaces.indexOf('<b:with'))).toEqual({
        baseIndent: '  ',
        stepIndent: '  ',
      })

      const source4Spaces = [
        '    <b:with var:a=\'1\'>',
        '        <div>content</div>',
        '    </b:with>',
      ].join('\n')
      expect(detectBaseIndent(source4Spaces, source4Spaces.indexOf('<b:with'))).toEqual({
        baseIndent: '    ',
        stepIndent: '    ',
      })
    })
  })

  describe('stripIndent', () => {
    it('returns empty string if text is empty', () => {
      expect(stripIndent('')).toBe('')
      expect(stripIndent(null)).toBe('')
    })

    it('strips common minimum indentation while preserving relative indentation', () => {
      const input = [
        '    <div>',
        '      <span>nested</span>',
        '    </div>',
      ].join('\n')

      const expected = [
        '<div>',
        '  <span>nested</span>',
        '</div>',
      ].join('\n')

      expect(stripIndent(input)).toBe(expected)
    })

    it('preserves blank lines without adding whitespace', () => {
      const input = '  line 1\n\n  line 2'
      expect(stripIndent(input)).toBe('line 1\n\nline 2')
    })

    it('preserves CRLF line endings', () => {
      const input = '  line 1\r\n  line 2'
      expect(stripIndent(input)).toBe('line 1\r\nline 2')
    })
  })

  describe('shiftIndent', () => {
    it('returns text untouched if text is empty or levels is 0', () => {
      expect(shiftIndent('', 2)).toBe('')
      expect(shiftIndent('hello', 0)).toBe('hello')
    })

    it('shifts indentation to the right with positive levels', () => {
      const input = [
        '  <div>',
        '    <span>text</span>',
        '  </div>',
      ].join('\n')

      const expected = [
        '      <div>',
        '        <span>text</span>',
        '      </div>',
      ].join('\n')

      expect(shiftIndent(input, 2, '  ')).toBe(expected)
    })

    it('shifts indentation with tabs', () => {
      const input = '\t<div>\n\t\t<span>tab</span>\n\t</div>'
      const expected = '\t\t\t<div>\n\t\t\t\t<span>tab</span>\n\t\t\t</div>'
      expect(shiftIndent(input, 2, '\t')).toBe(expected)
    })

    it('shifts indentation to the left with negative levels', () => {
      const input = [
        '      <div>',
        '        <span>text</span>',
        '      </div>',
      ].join('\n')

      const expected = [
        '  <div>',
        '    <span>text</span>',
        '  </div>',
      ].join('\n')

      expect(shiftIndent(input, -2, '  ')).toBe(expected)
    })

    it('preserves empty lines during shift', () => {
      const input = '  line1\n\n  line2'
      expect(shiftIndent(input, 1, '  ')).toBe('    line1\n\n    line2')
    })

    it('preserves CRLF line endings during shift', () => {
      const input = '  line1\r\n\r\n  line2'
      expect(shiftIndent(input, 1, '  ')).toBe('    line1\r\n\r\n    line2')
    })
  })

  describe('indentBlock', () => {
    it('returns original text if text or indent is falsy', () => {
      expect(indentBlock('', '  ')).toBe('')
      expect(indentBlock('hello', '')).toBe('hello')
    })

    it('indents non-empty lines and leaves blank lines empty', () => {
      const input = 'foo\n\nbar'
      expect(indentBlock(input, '  ')).toBe('  foo\n\n  bar')
    })

    it('supports numeric indent levels', () => {
      const input = 'foo\nbar'
      expect(indentBlock(input, 2, { stepIndent: '  ' })).toBe('    foo\n    bar')
      expect(indentBlock(input, 1, { stepIndent: '\t' })).toBe('\tfoo\n\tbar')
    })
  })

  describe('reindentBlock', () => {
    it('normalizes and re-indents to target base while preserving internal hierarchy', () => {
      const input = [
        '      <header>',
        '        <h1>Title</h1>',
        '      </header>',
      ].join('\n')

      const expected = [
        '  <header>',
        '    <h1>Title</h1>',
        '  </header>',
      ].join('\n')

      expect(reindentBlock(input, '  ')).toBe(expected)
    })
  })

  describe('formatNestedBlock', () => {
    it('returns single line with outerIndent', () => {
      expect(formatNestedBlock('<b:include name="foo"/>', '  ', '    ')).toBe('  <b:include name="foo"/>')
    })

    it('formats multiline XML element aligning outer tags and relative inner indentation', () => {
      const input = `
        <b:includable id='main'>
          <b:include name='title'/>
          <div>
            <span>nested</span>
          </div>
        </b:includable>
      `
      const formatted = formatNestedBlock(input, '  ', '    ')
      const lines = formatted.split('\n')

      expect(lines[0]).toBe('  <b:includable id=\'main\'>')
      expect(lines[1]).toBe('    <b:include name=\'title\'/>')
      expect(lines[2]).toBe('    <div>')
      expect(lines[3]).toBe('      <span>nested</span>')
      expect(lines[lines.length - 1]).toBe('  </b:includable>')
    })

    it('handles empty inner block gracefully', () => {
      const input = '<b:includable id=\'empty\'>\n</b:includable>'
      const formatted = formatNestedBlock(input, '  ', '    ')
      expect(formatted).toBe('  <b:includable id=\'empty\'>\n  </b:includable>')
    })
  })
})
