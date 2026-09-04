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
    it('formats elapsed time into seconds and milliseconds', () => {
      const start = 1000
      const end = 2500
      expect(measureTime(end, start)).toBe('1.50s (1500ms)')
    })

    it('handles zero or sub-second duration', () => {
      expect(measureTime(1050, 1000)).toBe('0.05s (50ms)')
    })
  })
})
