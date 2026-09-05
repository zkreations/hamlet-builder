import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

/**
 * Write file in the designated output directory.
 *
 * @param {object} options
 * @param {string} options.output - Output directory
 * @param {string} options.file - File name
 * @param {string} options.content - File content
 * @returns {Promise<void>}
 */
export async function writeOutput({ output, file, content }) {
  await fsp.mkdir(output, { recursive: true })
  const outputFile = path.join(output, file)
  await fsp.writeFile(outputFile, content)
}

/**
 * Read asset content synchronously with error handling.
 *
 * @param {string} resolvedPath - Absolute path to asset
 * @returns {{ content: string, error?: string }} Content object or error message
 */
export function getAsset(resolvedPath) {
  const fileName = path.basename(resolvedPath)

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8')
    return { content }
  }
  catch (error) {
    if (error && error.code === 'ENOENT') {
      const notFoundError = `The file "${fileName}" does not exist`
      return {
        content: `/* ${notFoundError} */`,
        error: notFoundError,
      }
    }

    throw error
  }
}
