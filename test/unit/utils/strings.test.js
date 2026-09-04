import { describe, expect, it } from 'vitest'
import { capitalize, sanitizeSpacing } from '../../../lib/utils/strings.js'

describe('string utilities', () => {
  describe('sanitizeSpacing', () => {
    it('removes newlines, collapses multiple spaces and trims', () => {
      const input = '  foo \n  bar   baz \n  '
      expect(sanitizeSpacing(input)).toBe('foo bar baz')
    })

    it('handles already clean strings', () => {
      expect(sanitizeSpacing('clean string')).toBe('clean string')
    })
  })

  describe('capitalize', () => {
    it('capitalizes the first letter of a word', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('world')).toBe('World')
    })

    it('returns empty string for non-string inputs', () => {
      expect(capitalize(null)).toBe('')
      expect(capitalize(undefined)).toBe('')
      expect(capitalize(123)).toBe('')
    })

    it('preserves casing of remaining letters', () => {
      expect(capitalize('camelCase')).toBe('CamelCase')
    })
  })
})
