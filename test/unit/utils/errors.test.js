import { describe, expect, it } from 'vitest'
import { getErrorDetails } from '../../../lib/utils/errors.js'

describe('error utilities', () => {
  describe('getErrorDetails', () => {
    it('extracts error message from Error instance', () => {
      const error = new Error('Template syntax error')
      const details = getErrorDetails(error)
      expect(details.message).toBe('Template syntax error')
      expect(details.line).toBeNull()
      expect(details.column).toBeNull()
    })

    it('extracts line and column if anonymous stack pattern exists', () => {
      const error = new Error('Parse error')
      error.stack = 'Error: Parse error\n    at eval (<anonymous>:12:34)'
      const details = getErrorDetails(error)
      expect(details.message).toBe('Parse error')
      expect(details.line).toBe('12')
      expect(details.column).toBe('34')
    })
  })
})
