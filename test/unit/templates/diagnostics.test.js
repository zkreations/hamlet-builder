import Handlebars from 'handlebars'
import { describe, expect, it } from 'vitest'
import {
  findHelperCallInAst,
  findPartialCallInAst,
  formatHandlebarsDiagnostic,
  formatLocation,
  parseErrorLocation,
  walkAst,
} from '../../../lib/templates/diagnostics.js'

describe('diagnostics utilities', () => {
  describe('parseErrorLocation', () => {
    it('returns null for invalid or missing error messages', () => {
      expect(parseErrorLocation(null)).toBeNull()
      expect(parseErrorLocation('')).toBeNull()
      expect(parseErrorLocation('Random error without parse info')).toBeNull()
    })

    it('extracts line and column from Handlebars parse error', () => {
      const errorMsg = `Parse error on line 4:
...line 3
{{#if unclosed}
--------------^
Expecting 'CLOSE_RAW_BLOCK', got 'INVALID'`

      const loc = parseErrorLocation(errorMsg)
      expect(loc).toEqual({ line: 4, column: 15 })
    })

    it('defaults column to 1 if caret line is missing', () => {
      const errorMsg = 'Parse error on line 12:\nsomething went wrong'
      const loc = parseErrorLocation(errorMsg)
      expect(loc).toEqual({ line: 12, column: 1 })
    })
  })

  describe('walkAst', () => {
    it('safely handles non-object nodes', () => {
      expect(walkAst(null, () => {})).toBe(false)
      expect(walkAst('string', () => {})).toBe(false)
    })

    it('traverses programs, blocks and parameters', () => {
      const ast = Handlebars.parse('{{#if condition}}{{> partialA param=(helperB)}}{{/if}}')
      const types = []
      walkAst(ast, (node) => {
        types.push(node.type)
      })

      expect(types).toContain('BlockStatement')
      expect(types).toContain('PartialStatement')
      expect(types).toContain('SubExpression')
    })

    it('stops traversal when visitor returns true', () => {
      const ast = Handlebars.parse('{{foo}}{{bar}}{{baz}}')
      let count = 0
      walkAst(ast, (node) => {
        if (node.type === 'MustacheStatement') {
          count++
          return true
        }
      })
      expect(count).toBe(1)
    })
  })

  describe('findPartialCallInAst', () => {
    it('returns null if ast is missing or partial is not found', () => {
      expect(findPartialCallInAst(null, 'missing')).toBeNull()
      const ast = Handlebars.parse('<div>No partials here</div>')
      expect(findPartialCallInAst(ast, 'header')).toBeNull()
    })

    it('locates a direct partial call', () => {
      const ast = Handlebars.parse('line 1\n  {{> header}}\nline 3')
      const loc = findPartialCallInAst(ast, 'header')
      expect(loc).toEqual({ line: 2, column: 2 })
    })

    it('locates partial calls inside conditionals and blocks', () => {
      const source = `line 1
{{#if condition}}
  line 3
  {{> sidebar}}
{{/if}}`
      const ast = Handlebars.parse(source)
      const loc = findPartialCallInAst(ast, 'sidebar')
      expect(loc).toEqual({ line: 4, column: 2 })
    })

    it('locates specific occurrences of repeated partial calls', () => {
      const source = `{{> widget}}
some text
{{> widget}}`
      const ast = Handlebars.parse(source)
      const first = findPartialCallInAst(ast, 'widget', 0)
      const second = findPartialCallInAst(ast, 'widget', 1)

      expect(first).toEqual({ line: 1, column: 0 })
      expect(second).toEqual({ line: 3, column: 0 })
    })
  })

  describe('findHelperCallInAst', () => {
    it('returns null if ast is missing or helper is not found', () => {
      expect(findHelperCallInAst(null, 'missingHelper')).toBeNull()
      const ast = Handlebars.parse('plain text')
      expect(findHelperCallInAst(ast, 'missingHelper')).toBeNull()
    })

    it('locates mustache helper calls', () => {
      const ast = Handlebars.parse('<div>\n    {{customHelper "arg"}}\n</div>')
      const loc = findHelperCallInAst(ast, 'customHelper')
      expect(loc).toEqual({ line: 2, column: 4 })
    })

    it('locates block helper calls', () => {
      const ast = Handlebars.parse('<div>\n  {{#customBlock}}\n    content\n  {{/customBlock}}\n</div>')
      const loc = findHelperCallInAst(ast, 'customBlock')
      expect(loc).toEqual({ line: 2, column: 2 })
    })
  })

  describe('formatLocation', () => {
    it('formats file without location if null', () => {
      expect(formatLocation('src/file.hbs', null)).toContain('src/file.hbs')
    })

    it('formats file with line and column', () => {
      expect(formatLocation('src/file.hbs', { line: 10, column: 5 })).toContain('src/file.hbs:10:5')
    })
  })

  describe('formatHandlebarsDiagnostic', () => {
    it('formats direct pre-validation error', () => {
      const error = new Error('Parse error')
      error.file = 'src/partials/_header.hbs'
      error.line = 5
      error.column = 8

      const diag = formatHandlebarsDiagnostic({
        error,
        rootFile: 'src/theme.xml',
      })

      expect(diag.location).toContain('src/partials/_header.hbs:5:8')
      expect(diag.inclusionStack).toHaveLength(0)
    })

    it('formats syntax error in root template', () => {
      const error = new Error(`Parse error on line 3:
{{#unclosed}
-----------^`)
      const diag = formatHandlebarsDiagnostic({
        error,
        rootFile: 'src/theme.xml',
      })

      expect(diag.location).toContain('src/theme.xml:3:12')
      expect(diag.inclusionStack).toHaveLength(0)
    })

    it('formats missing partial with nested inclusion stack', () => {
      const rootSource = 'root 1\n  {{> header}}\nroot 3'
      const rootAst = Handlebars.parse(rootSource)

      const headerSource = 'header 1\n    {{> example}}\nheader 3'
      const headerAst = Handlebars.parse(headerSource)

      const exampleSource = 'example 1\n        {{> hamlet.functionss}}\nexample 3'
      const exampleAst = Handlebars.parse(exampleSource)

      const error = new Error('The partial hamlet.functionss could not be found')
      error.__renderStack = [
        {
          name: '<root>',
          file: 'src/templates/hamlet.hbs',
          ast: rootAst,
        },
        {
          name: 'header',
          file: 'src/templates/partials/header.hbs',
          ast: headerAst,
          callSite: { line: 2, column: 2 },
        },
        {
          name: 'example',
          file: 'src/templates/partials/example.hbs',
          ast: exampleAst,
          callSite: { line: 2, column: 4 },
        },
      ]

      const diag = formatHandlebarsDiagnostic({
        error,
        rootFile: 'src/templates/hamlet.hbs',
        rootAst,
      })

      expect(diag.location).toContain('src/templates/partials/example.hbs:2:8')
      expect(diag.inclusionStack).toHaveLength(2)
      expect(diag.inclusionStack[0]).toContain('included from')
      expect(diag.inclusionStack[0]).toContain('src/templates/partials/header.hbs:2:4')
      expect(diag.inclusionStack[1]).toContain('included from')
      expect(diag.inclusionStack[1]).toContain('src/templates/hamlet.hbs:2:2')
    })

    it('formats helper runtime error inside partial', () => {
      const partialSource = 'line 1\n  {{brokenHelper}}\nline 3'
      const partialAst = Handlebars.parse(partialSource)

      const error = new TypeError('Cannot read property of undefined')
      error.__activeHelper = 'brokenHelper'
      error.__renderStack = [
        {
          name: '<root>',
          file: 'src/templates/hamlet.hbs',
        },
        {
          name: 'widget',
          file: 'src/templates/partials/widget.hbs',
          ast: partialAst,
          callSite: { line: 5, column: 0 },
        },
      ]

      const diag = formatHandlebarsDiagnostic({
        error,
        rootFile: 'src/templates/hamlet.hbs',
      })

      expect(diag.location).toContain('src/templates/partials/widget.hbs:2:2')
      expect(diag.inclusionStack).toHaveLength(1)
      expect(diag.inclusionStack[0]).toContain('included from src/templates/hamlet.hbs:5:0')
    })

    it('formats missing partial called directly from root', () => {
      const rootSource = 'root 1\n  {{> notFound}}\nroot 3'
      const rootAst = Handlebars.parse(rootSource)
      const error = new Error('The partial notFound could not be found')

      const diag = formatHandlebarsDiagnostic({
        error,
        rootFile: 'src/templates/hamlet.hbs',
        rootAst,
      })

      expect(diag.location).toContain('src/templates/hamlet.hbs:2:2')
      expect(diag.inclusionStack).toHaveLength(0)
    })
  })
})
