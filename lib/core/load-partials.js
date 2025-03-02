import chalk from 'chalk'
import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'

// Get all partials from the input directory
// @param {string} input - The input directory
// @return object
export const loadPartials = (input) => {
  // Search for all xml and hbs files that start with an underscore
  const files = globSync(`${input}/**/_*.{xml,hbs}`)

  if (files.length === 0) {
    return {}
  }

  const partials = {}
  const folders = {}

  files.forEach(file => {
    const extension = path.extname(file)
    const partialName = path.basename(file, extension).replace(/^_/, '')
    const folderName = path.basename(path.dirname(file))

    // If the partial has already been registered, show a warning
    if (partials[partialName]) {
      console.warn(`\n${chalk.yellow('[Warning]')} {{> ${partialName}}} is duplicate:`)
      console.warn(`${partials[partialName].file} (registered)`)
      console.warn(`${file} (duplicate)\n`)
      return
    }

    const partialTemplate = (fs.readFileSync(file, 'utf8').trim()) + '\n'

    partials[partialName] = {
      template: partialTemplate,
      file
    }

    if (!folders[folderName]) {
      folders[folderName] = []
    }

    folders[folderName].push(`{{> ${partialName}}}`)
  })

  Object.entries(folders).forEach(([folder, partialList]) => {
    partialList.sort()

    if (partialList.length <= 1) {
      return
    }

    const folderPartialName = `folder.${folder}`

    partials[folderPartialName] = {
      template: partialList.join('\n')
    }
  })

  return Object.fromEntries(Object.entries(partials)
    .map(([key, value]) => [key, value.template]))
}
