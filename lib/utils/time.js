/**
 * Current timestamp formatted as HH:MM:SS.
 *
 * @returns {string} - Current time
 */
export function currentTime() {
  const date = new Date()
  return date.toLocaleTimeString('en-US', { hour12: false })
}

/**
 * Measure elapsed time between two performance marks.
 *
 * @param {number} end - End time in ms
 * @param {number} start - Start time in ms
 * @returns {string} - Formatted time string
 */
export function measureTime(end, start) {
  const time = end - start
  const seconds = (time / 1000).toFixed(2)
  return `${seconds}s (${Math.round(time)}ms)`
}
