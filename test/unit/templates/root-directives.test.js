import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractRootDirectives,
  parseBooleanDirective,
  resolveEffectiveDocumentOption,
  stripRootDirectives,
} from '../../../lib/templates/root-directives.js'
import { logger } from '../../../lib/utils/logger.js'

describe('root-directives module', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('extractRootDirectives', () => {
    it('extracts raw values of directives from <html> tag without forced casting', () => {
      const template = `<html h:resolveMarkups="false" h:customString='some-value'><head></head></html>`
      vi.spyOn(logger, 'warn').mockImplementation(() => {})

      const directives = extractRootDirectives(template)

      expect(directives).toEqual({
        resolveMarkups: 'false',
        customString: 'some-value',
      })
    })

    it('handles bare attributes as true', () => {
      const template = `<html h:resolveMarkups h:mergeMarkups><body></body></html>`
      const directives = extractRootDirectives(template)

      expect(directives).toEqual({
        resolveMarkups: true,
        mergeMarkups: true,
      })
    })

    it('emits a warning when an unknown h:* directive is encountered', () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
      const template = `<html h:resolveMarkups="true" h:unknownDirective="foo"></html>`

      const directives = extractRootDirectives(template, { file: 'src/index.xml' })

      expect(directives).toEqual({
        resolveMarkups: 'true',
        unknownDirective: 'foo',
      })
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown Hamlet root directive \'h:unknownDirective\''),
        'src/index.xml',
      )
    })

    it('ignores h:* attributes on non-root elements', () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
      const template = `<html><body><div h:resolveMarkups="false">content</div></body></html>`

      const directives = extractRootDirectives(template)

      expect(directives).toEqual({})
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('returns empty object when input is invalid or missing <html>', () => {
      expect(extractRootDirectives(null)).toEqual({})
      expect(extractRootDirectives('')).toEqual({})
      expect(extractRootDirectives('<div>no html tag</div>')).toEqual({})
    })
  })

  describe('stripRootDirectives', () => {
    it('removes all h:* directives strictly from root <html> tag', () => {
      const template = `<html lang="en" h:resolveMarkups="false" b:css="false" h:unknown="val"><body></body></html>`
      const cleaned = stripRootDirectives(template)

      expect(cleaned).toBe(`<html lang="en" b:css="false"><body></body></html>`)
      expect(cleaned).not.toContain('h:resolveMarkups')
      expect(cleaned).not.toContain('h:unknown')
    })

    it('does not touch h:* attributes on non-root elements', () => {
      const template = `<html h:resolveMarkups="true"><body><div h:test="value"></div></body></html>`
      const cleaned = stripRootDirectives(template)

      expect(cleaned).toContain('<div h:test="value">')
      expect(cleaned).not.toContain('h:resolveMarkups')
    })

    it('returns untouched string if no h: directive is present', () => {
      const template = `<html lang="es"><body class="test"></body></html>`
      expect(stripRootDirectives(template)).toBe(template)
    })
  })

  describe('parseBooleanDirective', () => {
    it('parses boolean values and string representations accurately', () => {
      expect(parseBooleanDirective(true)).toBe(true)
      expect(parseBooleanDirective(false)).toBe(false)
      expect(parseBooleanDirective('true')).toBe(true)
      expect(parseBooleanDirective('TRUE')).toBe(true)
      expect(parseBooleanDirective('1')).toBe(true)
      expect(parseBooleanDirective('')).toBe(true)
      expect(parseBooleanDirective('false')).toBe(false)
      expect(parseBooleanDirective('FALSE')).toBe(false)
      expect(parseBooleanDirective('0')).toBe(false)
      expect(parseBooleanDirective('invalid', true)).toBe(true)
      expect(parseBooleanDirective('invalid', false)).toBe(false)
    })
  })

  describe('resolveEffectiveDocumentOption', () => {
    it('prefers root directive over config and default', () => {
      const rootDirectives = { resolveMarkups: 'false' }
      const config = { resolveMarkups: true }

      const result = resolveEffectiveDocumentOption(
        'resolveMarkups',
        rootDirectives,
        config,
        true,
        parseBooleanDirective,
      )

      expect(result).toBe(false)
    })

    it('prefers config over default when root directive is not set', () => {
      const rootDirectives = {}
      const config = { resolveMarkups: false }

      const result = resolveEffectiveDocumentOption(
        'resolveMarkups',
        rootDirectives,
        config,
        true,
        parseBooleanDirective,
      )

      expect(result).toBe(false)
    })

    it('falls back to default value when neither root directive nor config is set', () => {
      const result = resolveEffectiveDocumentOption(
        'resolveMarkups',
        {},
        {},
        true,
        parseBooleanDirective,
      )

      expect(result).toBe(true)
    })
  })
})
