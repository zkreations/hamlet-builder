import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import { globSync } from 'glob'
import { hamletPartials } from '../data/partials.js'

const GROUP_RE = /<Group\s+description="([^"]+)">([\s\S]*?)<\/Group>/g
const VARIABLE_RE = /<Variable\s([^>]*)>/g
const ATTR_RE = /(name|type)="([^"]+)"/g
const ALLOWED_TYPES = new Set(['background', 'color', 'font'])

// Extract variables from Group sections in partials
// @param {string} input - The input directory
// @return object
function extractGroupVariables(contents) {
  const parseAttrs = (str = '') => {
    const attrs = {}

    ATTR_RE.lastIndex = 0
    let match = ATTR_RE.exec(str)

    while (match !== null) {
      attrs[match[1]] = match[2]
      match = ATTR_RE.exec(str)
    }

    return attrs
  }

  const parseVariables = (groupContent) => {
    const variables = []

    VARIABLE_RE.lastIndex = 0
    let match = VARIABLE_RE.exec(groupContent)

    while (match !== null) {
      const { name, type } = parseAttrs(match[1])

      if (name && ALLOWED_TYPES.has(type))
        variables.push({ name, type })

      match = VARIABLE_RE.exec(groupContent)
    }

    return variables
  }

  const variablesByGroup = {}

  for (const content of contents) {
    GROUP_RE.lastIndex = 0
    let groupMatch = GROUP_RE.exec(content)

    while (groupMatch !== null) {
      const [, description, groupContent] = groupMatch

      const existingVariables = (variablesByGroup[description] ??= [])
      const existingNames = new Set(existingVariables.map(variable => variable.name))

      for (const variable of parseVariables(groupContent)) {
        if (!existingNames.has(variable.name)) {
          existingVariables.push(variable)
          existingNames.add(variable.name)
        }
      }

      groupMatch = GROUP_RE.exec(content)
    }
  }

  return variablesByGroup
}

// Create CSS variables from the extracted group variables
// @param {object} groupVariables - The variables grouped by their Group description
// @return string
function createHamletSkinVars(groupVariables) {
  const toKebab = name => name.replaceAll('.', '-')
  const toRef = name => `$(${name})`

  const lines = Object.entries(groupVariables).flatMap(([groupName, variables]) => {
    if (!variables.length)
      return []

    const declarations = variables.flatMap(({ name, type }) => {
      const prop = `--${toKebab(name)}: ${toRef(name)};`
      return type === 'font'
        ? [prop, `--${toKebab(name)}-family: ${toRef(`${name}.family`)};`]
        : [prop]
    })

    return [`/* ${groupName} Group */`, ...declarations, '']
  })

  if (lines.length === 0)
    return '/* No Group variables found */\n'

  return lines.join('\n')
}

// Get all partials from the input directory
// @param {string} input - The input directory
// @return object
async function collectPartials(input) {
  // Search for all xml and hbs files that start with an underscore
  const files = globSync(`${input}/**/_*.@(xml|hbs|handlebars)`)

  if (files.length === 0) {
    return {
      partials: {},
      normalPartials: [],
      folderPartials: [],
      duplicates: [],
      folderDuplicates: [],
      hamletPartials: Object.keys(hamletPartials),
    }
  }

  const contents = await Promise.all(files.map(file => fs.readFile(file, 'utf8')))

  const partials = {}
  const foldersByPath = {}
  const normalPartials = []
  const duplicates = []
  const duplicatesByPartial = new Map()

  const groupVariables = extractGroupVariables(contents)
  const hamletCssVars = createHamletSkinVars(groupVariables)
  hamletPartials['hamlet.skinVars'] = { template: hamletCssVars }
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
  }
}

// Print the list of duplicates
// @param {string} title - The title to show before the list
// @param {array} items - The list of duplicates to show
function printDuplicates(title, items) {
  if (items.length === 0)
    return

  console.warn(chalk.yellow(title))
  items.forEach((item) => {
    console.warn(`  - {{> ${item.name}}}`)
    console.warn(`      registered: ${item.registered}`)
    item.duplicates.forEach((duplicate) => {
      console.warn(`      duplicate:  ${duplicate}`)
    })
  })
  console.warn('')
}

// Print the list of partials
// @param {string} title - The title to show before the list
// @param {array} items - The list of partials to show
function printPartialsList(title, items) {
  console.warn(chalk.blue(title))

  if (items.length === 0) {
    console.warn('  There are no partials registered of this type.')
    console.warn('')
    return
  }

  items.forEach(item => console.warn(`  - {{> ${item}}}`))
  console.warn('')
}

// Load partials and return an object with the partials content
// @param {string} input - The input directory
// @return object
export async function loadPartials(input) {
  const { partials, duplicates, folderDuplicates } = await collectPartials(input)

  printDuplicates(`${chalk.yellow('[Warning]')} Conflicts (duplicates):`, duplicates)
  printDuplicates(`${chalk.yellow('[Warning]')} Conflicts (folder duplicates):`, folderDuplicates)

  return Object.fromEntries(Object.entries(partials)
    .map(([key, value]) => [key, value.template]))
}

// Load partials info and print it to the console
// @param {string} input - The input directory
// @return void
export async function loadPartialsInfo(input) {
  const { normalPartials, folderPartials, duplicates, folderDuplicates, hamletPartials } = await collectPartials(input)

  printPartialsList('Partials (hamlet):', hamletPartials.sort())
  printPartialsList('Partials (normal):', normalPartials.sort())
  printPartialsList('Partials (folders):', folderPartials.sort())
  printDuplicates('Conflicts (duplicates):', duplicates)
  printDuplicates('Conflicts (folder duplicates):', folderDuplicates)
}
