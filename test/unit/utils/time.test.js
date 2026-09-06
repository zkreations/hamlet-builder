import { describe, expect, it } from 'vitest'
import { currentTime, measureTime } from '../../../lib/utils/time.js'

describe('time utilities', () => {
  describe('currentTime', () => {
    it('returns a formatted time string in HH:MM:SS format', () => {
      const time = currentTime()
      expect(time).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })
  })

  describe('measureTime', () => {
    it('formats elapsed time into seconds when >= 1000ms', () => {
      const start = 1000
      const end = 2500
      expect(measureTime(end, start)).toBe('1.50s')
    })

    it('formats elapsed time into milliseconds when < 1000ms', () => {
      expect(measureTime(1050, 1000)).toBe('50ms')
      expect(measureTime(1000, 1000)).toBe('0ms')
    })
  })
})
