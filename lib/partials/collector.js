import fs from 'node:fs/promises'
import path from 'node:path'
import { styleText } from 'node:util'
import { globSync } from 'glob'
import { hamletPartials } from '../data/partials.js'
import { createHamletSkinVars, extractGroupVariables } from './skin-vars.js'

const GLOB_IGNORED = ['**/node_modules/**', '**/.git/**']

/**
 * Print the list of duplicate partial conflicts.
 *
 * @param {string} title - The title to show before the list
 * @param {Array<object>} items - The list of duplicates to show
 */
export function printDuplicates(title, items) {
  if (!items || items.length === 0)
    return

  console.warn(styleText('yellow', title))
  items.forEach((item) => {
    console.warn(`  - {{> ${item.name}}}`)
    console.warn(`      registered: ${item.registered}`)
    item.duplicates.forEach((duplicate) => {
      console.warn(`      duplicate:  ${duplicate}`)
    })
  })
  console.warn('')
}

/**
 * Collect all partials from the input directory.
 *
 * @param {string} input - The input directory
 * @returns {Promise<object>} Partials collection metadata and content
 */
export async function collectPartials(input) {
  const files = globSync(`${input}/**/_*.@(xml|hbs|handlebars)`, {
    ignore: GLOB_IGNORED,
  })

  if (files.length === 0) {
    return {
      partials: {},
      normalPartials: [],
      folderPartials: [],
      duplicates: [],
      folderDuplicates: [],
      hamletPartials: Object.keys(hamletPartials),
      normalPartialsByFolder: {},
      folderPartialsInfo: [],
    }
  }

  const contents = await Promise.all(files.map(file => fs.readFile(file, 'utf8')))

  const partials = {}
  const foldersByPath = {}
  const normalPartials = []
  const normalPartialsByFolder = {}
  const duplicates = []
  const duplicatesByPartial = new Map()

  const groupVariables = extractGroupVariables(contents)
  const hamletCssVars = createHamletSkinVars(groupVariables)
  partials['hamlet.skinVars'] = { template: hamletCssVars }

  files.forEach((file, i) => {
    const extension = path.extname(file)
    const partialName = path.basename(file, extension).replace(/^_/, '')
    const folderPath = path.dirname(file)
    const folderName = path.basename(folderPath)

    if (partials[partialName]) {
      if (!duplicatesByPartial.has(partialName)) {
        duplicatesByPartial.set(partialName, {
          name: partialName,
          registered: partials[partialName].file,
          duplicates: [],
        })
      }

      duplicatesByPartial.get(partialName).duplicates.push(file)
      duplicates.push({
        name: partialName,
        registered: partials[partialName].file,
        duplicate: file,
      })

      if (!foldersByPath[folderPath]) {
        foldersByPath[folderPath] = { folderName, partials: [], hasDuplicates: false }
      }
      foldersByPath[folderPath].hasDuplicates = true
      foldersByPath[folderPath].partials.push(`{{> ${partialName}}}`)
      return
    }

    const partialTemplate = `${contents[i].trim()}\n`

    partials[partialName] = {
      template: partialTemplate,
      file,
    }

    normalPartials.push(partialName)

    if (!normalPartialsByFolder[folderPath]) {
      normalPartialsByFolder[folderPath] = []
    }

    normalPartialsByFolder[folderPath].push(partialName)

    if (!foldersByPath[folderPath]) {
      foldersByPath[folderPath] = { folderName, partials: [], hasDuplicates: false }
    }

    foldersByPath[folderPath].partials.push(`{{> ${partialName}}}`)
  })

  const folderPartials = []
  const folderDuplicates = []
  const folderDuplicatesByName = new Map()
  const seenFolderNames = {}

  Object.entries(foldersByPath).forEach(([folderPath, info]) => {
    const { folderName } = info
    const folderPartialName = `folder.${folderName}`

    info.partials.sort()

    if (info.partials.length === 0) {
      return
    }

    if (seenFolderNames[folderName]) {
      const registered = seenFolderNames[folderName]

      if (!folderDuplicatesByName.has(folderPartialName)) {
        folderDuplicatesByName.set(folderPartialName, {
          name: folderPartialName,
          registered: registered.path,
          duplicates: [],
        })
      }

      folderDuplicatesByName.get(folderPartialName).duplicates.push(folderPath)
      folderDuplicates.push({
        name: folderPartialName,
        registered: registered.path,
        duplicate: folderPath,
      })

      return
    }

    seenFolderNames[folderName] = { path: folderPath }
    partials[folderPartialName] = { template: info.partials.join('\n') }
    folderPartials.push(folderPartialName)
  })

  const folderPartialsInfo = Object.entries(seenFolderNames)
    .map(([folderName, { path: folderPath }]) => ({
      name: `folder.${folderName}`,
      folderPath,
      count: foldersByPath[folderPath]?.partials.length ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    partials,
    normalPartials,
    folderPartials,
    hamletPartials: Object.keys(hamletPartials),
    duplicates: Array.from(duplicatesByPartial.values())
      .map(item => ({ ...item, duplicates: item.duplicates.sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    folderDuplicates: Array.from(folderDuplicatesByName.values())
      .map(item => ({ ...item, duplicates: item.duplicates.sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    normalPartialsByFolder,
    folderPartialsInfo,
  }
}

/**
 * Load partials and return an object with the partials template strings.
 *
 * @param {string} input - The input directory
 * @returns {Promise<Record<string, string>>} Mapping of partial name to template
 */
export async function loadPartials(input) {
  const { partials, duplicates, folderDuplicates } = await collectPartials(input)

  printDuplicates(`${styleText('yellow', '[Warning]')} Conflicts (duplicates):`, duplicates)
  printDuplicates(`${styleText('yellow', '[Warning]')} Conflicts (folder duplicates):`, folderDuplicates)

  return Object.fromEntries(
    Object.entries(partials).map(([key, value]) => [key, value.template]),
  )
}
