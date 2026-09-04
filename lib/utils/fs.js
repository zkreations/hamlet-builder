import fs from 'node:fs'
import path from 'node:path'

/**
 * Write file in the designated output directory.
 *
 * @param {object} options
 * @param {string} options.output - Output directory
 * @param {string} options.file - File name
 * @param {string} options.content - File content
 */
export function writeOutput({ output, file, content }) {
  fs.mkdirSync(output, { recursive: true })
  const outputFile = path.join(output, file)
  fs.writeFileSync(outputFile, content)
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
  catch {
    const error = `The file "${fileName}" does not exist`
    return {
      content: `/* ${error} */`,
      error,
    }
  }
}
