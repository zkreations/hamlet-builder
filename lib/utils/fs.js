import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

export async function writeOutput({ output, file, content }) {
  await fsp.mkdir(output, { recursive: true })
  const outputFile = path.join(output, file)
  await fsp.writeFile(outputFile, content)
}

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
