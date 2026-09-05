import Handlebars from 'handlebars'
import { describe, expect, it } from 'vitest'
import { createHelpers } from '../../../lib/templates/helpers.js'

const helpers = createHelpers()

describe('handlebars helpers', () => {
  describe('logic helpers in Handlebars templates', () => {
    it('evaluates eq and ne within conditional subexpressions', () => {
      const hbs = Handlebars.create()
      hbs.registerHelper(helpers)
      const template = hbs.compile('{{#if (eq role "admin")}}ADMIN{{else}}USER{{/if}}')
      expect(template({ role: 'admin' })).toBe('ADMIN')
      expect(template({ role: 'guest' })).toBe('USER')

      const neTemplate = hbs.compile('{{#if (ne status "draft")}}PUBLISHED{{/if}}')
      expect(neTemplate({ status: 'published' })).toBe('PUBLISHED')
      expect(neTemplate({ status: 'draft' })).toBe('')
    })

    it('evaluates and, or, and not within conditional subexpressions', () => {
      const hbs = Handlebars.create()
      hbs.registerHelper(helpers)
      const template = hbs.compile('{{#if (and isReady (not isBlocked))}}READY{{else}}WAIT{{/if}}')
      expect(template({ isReady: true, isBlocked: false })).toBe('READY')
      expect(template({ isReady: true, isBlocked: true })).toBe('WAIT')

      const orTemplate = hbs.compile('{{#if (or isVip isStaff)}}ACCESS{{/if}}')
      expect(orTemplate({ isVip: true, isStaff: false })).toBe('ACCESS')
      expect(orTemplate({ isVip: false, isStaff: false })).toBe('')
    })

    it('evaluates comparison helpers lt and gt', () => {
      expect(helpers.lt(2, 5)).toBe(true)
      expect(helpers.lt(5, 2)).toBe(false)
      expect(helpers.gt(5, 2)).toBe(true)
      expect(helpers.gt(2, 5)).toBe(false)
    })
  })

  describe('string and array helpers', () => {
    it('concat concatenates strings ignoring the last handlebars options argument', () => {
      const hbsOptions = { name: 'concat', hash: {} }
      expect(helpers.concat('hello', ' ', 'world', hbsOptions)).toBe('hello world')
    })

    it('includes checks substring inclusion safely', () => {
      expect(helpers.includes('hamlet-builder', 'builder')).toBe(true)
      expect(helpers.includes('hamlet', 'other')).toBe(false)
      expect(helpers.includes(null, 'test')).toBe(false)
    })

    it('first and last retrieve array items safely', () => {
      const arr = ['alpha', 'beta', 'gamma']
      expect(helpers.first(arr)).toBe('alpha')
      expect(helpers.last(arr)).toBe('gamma')
      expect(helpers.first([])).toBeUndefined()
      expect(helpers.first(null)).toBeUndefined()
    })

    it('currentYear returns the four-digit current year', () => {
      expect(helpers.currentYear()).toBe(new Date().getFullYear())
    })
  })

  describe('switch / Case / Default block helpers with Handlebars', () => {
    it('renders matching case branch', () => {
      const hbs = Handlebars.create()
      hbs.registerHelper(helpers)
      const template = hbs.compile('{{#switch status}}{{#case "active"}}Active{{/case}}{{#case "inactive"}}Inactive{{/case}}{{/switch}}')
      expect(template({ status: 'active' })).toBe('Active')
      expect(template({ status: 'inactive' })).toBe('Inactive')
    })

    it('renders default branch when no case matches', () => {
      const hbs = Handlebars.create()
      hbs.registerHelper(helpers)
      const template = hbs.compile('{{#switch status}}{{#case "active"}}Active{{/case}}{{#default}}Unknown{{/default}}{{/switch}}')
      expect(template({ status: 'other' })).toBe('Unknown')
    })

    it('correctly handles nested switch statements without context corruption', () => {
      const hbs = Handlebars.create()
      hbs.registerHelper(helpers)
      const template = hbs.compile(`
        {{#switch outer}}
          {{#case "A"}}
            [A:{{#switch inner}}{{#case "1"}}one{{/case}}{{#case "2"}}two{{/case}}{{/switch}}]
          {{/case}}
          {{#case "B"}}
            [B:match]
          {{/case}}
        {{/switch}}
      `.trim())

      expect(template({ outer: 'A', inner: '1' }).trim()).toBe('[A:one]')
      expect(template({ outer: 'A', inner: '2' }).trim()).toBe('[A:two]')
      expect(template({ outer: 'B', inner: '1' }).trim()).toBe('[B:match]')
    })

    it('works with frozen context objects', () => {
      const hbs = Handlebars.create()
      hbs.registerHelper(helpers)
      const template = hbs.compile('{{#switch val}}{{#case "x"}}X{{/case}}{{/switch}}')
      const frozenContext = Object.freeze({ val: 'x' })
      expect(() => template(frozenContext)).not.toThrow()
      expect(template(frozenContext)).toBe('X')
    })
  })
})
