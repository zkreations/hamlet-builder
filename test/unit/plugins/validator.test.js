import { describe, expect, it } from 'vitest'
import {
  isValidContext,
  isValidHelper,
  isValidHelperName,
  isValidNamespace,
  isValidPartial,
  isValidPartialName,
  isValidPluginShape,
} from '../../../lib/plugins/validator.js'

describe('plugin validators', () => {
  describe('isValidNamespace', () => {
    it('accepts alphanumeric namespaces starting with a letter', () => {
      expect(isValidNamespace('myPlugin')).toBe(true)
      expect(isValidNamespace('seo2')).toBe(true)
      expect(isValidNamespace('Blog')).toBe(true)
    })

    it('rejects "hamlet" (reserved)', () => {
      expect(isValidNamespace('hamlet')).toBe(false)
      expect(isValidNamespace('Hamlet')).toBe(false)
    })

    it('rejects prototype pollution names', () => {
      expect(isValidNamespace('__proto__')).toBe(false)
      expect(isValidNamespace('constructor')).toBe(false)
      expect(isValidNamespace('prototype')).toBe(false)
    })

    it('rejects non-strings or invalid characters', () => {
      expect(isValidNamespace('')).toBe(false)
      expect(isValidNamespace(123)).toBe(false)
      expect(isValidNamespace('my-plugin')).toBe(false)
      expect(isValidNamespace('my_plugin')).toBe(false)
    })
  })

  describe('isValidPartialName', () => {
    it('accepts valid partial names', () => {
      expect(isValidPartialName('header')).toBe(true)
      expect(isValidPartialName('nav-bar')).toBe(true)
      expect(isValidPartialName('footer_menu')).toBe(true)
      expect(isValidPartialName('item.detail')).toBe(true)
    })

    it('rejects blocked prototype property names', () => {
      expect(isValidPartialName('__proto__')).toBe(false)
      expect(isValidPartialName('constructor')).toBe(false)
    })
  })

  describe('isValidHelperName', () => {
    it('accepts valid helper names', () => {
      expect(isValidHelperName('formatDate')).toBe(true)
      expect(isValidHelperName('to-upper')).toBe(true)
      expect(isValidHelperName('safe_url')).toBe(true)
    })

    it('rejects blocked prototype property names', () => {
      expect(isValidHelperName('__proto__')).toBe(false)
    })
  })

  describe('isValidPartial', () => {
    it('returns true only for strings', () => {
      expect(isValidPartial('<div>{{content}}</div>')).toBe(true)
      expect(isValidPartial(123)).toBe(false)
      expect(isValidPartial(null)).toBe(false)
      expect(isValidPartial({})).toBe(false)
    })
  })

  describe('isValidHelper', () => {
    it('returns true only for functions', () => {
      expect(isValidHelper(() => {})).toBe(true)
      expect(isValidHelper(() => {})).toBe(true)
      expect(isValidHelper('fn')).toBe(false)
      expect(isValidHelper(null)).toBe(false)
    })
  })

  describe('isValidPluginShape', () => {
    it('returns true for plain objects', () => {
      expect(isValidPluginShape({})).toBe(true)
      expect(isValidPluginShape({ namespace: 'seo' })).toBe(true)
    })

    it('returns false for null, primitives, or arrays', () => {
      expect(isValidPluginShape(null)).toBe(false)
      expect(isValidPluginShape(undefined)).toBe(false)
      expect(isValidPluginShape([])).toBe(false)
      expect(isValidPluginShape('string')).toBe(false)
    })
  })

  describe('isValidContext', () => {
    it('returns true for plain objects', () => {
      expect(isValidContext({})).toBe(true)
      expect(isValidContext({ siteTitle: 'Demo' })).toBe(true)
    })

    it('returns false for arrays and primitives', () => {
      expect(isValidContext([])).toBe(false)
      expect(isValidContext('test')).toBe(false)
      expect(isValidContext(null)).toBe(false)
    })
  })
})
