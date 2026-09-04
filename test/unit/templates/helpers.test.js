import Handlebars from 'handlebars'
import { describe, expect, it } from 'vitest'
import helpers from '../../../lib/templates/helpers.js'

describe('handlebars helpers', () => {
  describe('logic helpers', () => {
    it('eq checks strict equality', () => {
      expect(helpers.eq(5, 5)).toBe(true)
      expect(helpers.eq('5', 5)).toBe(false)
    })

    it('ne checks strict inequality', () => {
      expect(helpers.ne(5, 6)).toBe(true)
      expect(helpers.ne(5, 5)).toBe(false)
    })

    it('lt and gt compare numbers', () => {
      expect(helpers.lt(2, 5)).toBe(true)
      expect(helpers.lt(5, 2)).toBe(false)
      expect(helpers.gt(5, 2)).toBe(true)
      expect(helpers.gt(2, 5)).toBe(false)
    })

    it('and and or perform boolean operations', () => {
      expect(helpers.and(true, 1)).toBe(true)
      expect(helpers.and(true, 0)).toBe(false)
      expect(helpers.or(false, 'yes')).toBe(true)
      expect(helpers.or(false, null)).toBe(false)
    })

    it('not negates value', () => {
      expect(helpers.not(true)).toBe(false)
      expect(helpers.not(false)).toBe(true)
    })
  })

  describe('string and Array helpers', () => {
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
  })
})
