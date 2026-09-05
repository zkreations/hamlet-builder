import { describe, expect, it } from 'vitest'
import { getAttr, getAttrValue, removeAttr, replaceAttrValue } from '../../../lib/utils/xml-attrs.js'

describe('xml attribute utilities', () => {
  describe('getAttr', () => {
    it('returns the attribute string if found', () => {
      const tag = '<b:widget id="header1" type="Header">'
      expect(getAttr(tag, 'id')).toBe('id="header1"')
      expect(getAttr(tag, 'type')).toBe('type="Header"')
    })

    it('returns null if the attribute is not found', () => {
      const tag = '<b:widget id="header1">'
      expect(getAttr(tag, 'version')).toBeNull()
    })

    it('matches single quotes as well', () => {
      const tag = '<b:widget id=\'header1\'>'
      expect(getAttr(tag, 'id')).toBe('id=\'header1\'')
    })
  })

  describe('getAttrValue', () => {
    it('extracts attribute value with double quotes', () => {
      const tag = '<Variable name="color" value="#fff"/>'
      expect(getAttrValue(tag, 'name')).toBe('color')
      expect(getAttrValue(tag, 'value')).toBe('#fff')
    })

    it('extracts attribute value with single quotes', () => {
      const tag = '<Variable name=\'mainColor\' value=\'#000\'/>'
      expect(getAttrValue(tag, 'name')).toBe('mainColor')
      expect(getAttrValue(tag, 'value')).toBe('#000')
    })

    it('returns null if attribute is absent', () => {
      const tag = '<Variable name="color"/>'
      expect(getAttrValue(tag, 'value')).toBeNull()
    })
  })

  describe('removeAttr', () => {
    it('removes the specified attribute from tag', () => {
      const tag = '<b:widget id="header1" type="Header">'
      const result = removeAttr(tag, 'type')
      expect(result).not.toContain('type=')
      expect(result).toContain('id="header1"')
    })
  })

  describe('replaceAttrValue', () => {
    it('replaces the attribute value with single quotes', () => {
      const tag = '<b:widget id="header1" type="Invalid">'
      const result = replaceAttrValue(tag, 'type', 'HTML')
      expect(result).toContain('type=\'HTML\'')
    })
  })
})
