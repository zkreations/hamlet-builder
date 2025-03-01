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
    const folderName = path.dirname(file).split(path.sep).pop()

    // If the partial has already been registered, show a warning
    if (partials[partialName]) {
      console.warn(`Partial: {{> ${partialName}}} is duplicate:\n${file}`)
      return
    }

    const partialTemplate = (fs.readFileSync(file, 'utf8').trim()) + '\n'
    partials[partialName] = partialTemplate

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

    // Check if the folder partial is already registered
    if (partials[folderPartialName]) {
      console.warn(`Folder partial: {{> ${folderPartialName}}} is duplicate.`)
      return
    }

    partials[folderPartialName] = partialList.join('\n') + '\n'
  })

  return partials
}
