export function currentTime() {
  const date = new Date()
  return date.toLocaleTimeString('en-US', { hour12: false })
}

export function measureTime(end, start) {
  const ms = Math.round(end - start)
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}
