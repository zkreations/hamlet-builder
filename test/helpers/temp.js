import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Create a temporary directory with a unique prefix and provide a cleanup function.
 *
 * @param {string} [prefix] - Directory name prefix
 * @returns {{ dir: string, cleanup: () => void }} Object containing the created directory path and cleanup function
 */
export function createTempDir(prefix = 'hamlet-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  return {
    dir,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
