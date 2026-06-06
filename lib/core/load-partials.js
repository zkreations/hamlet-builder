import chalk from 'chalk'
import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'
import { hamletPartials } from '../data/partials.js'

// Get all partials from the input directory
// @param {string} input - The input directory
// @return object
const collectPartials = (input) => {
  // Search for all xml and hbs files that start with an underscore
  const files = globSync(`${input}/**/_*.@(xml|hbs|handlebars)`)

  if (files.length === 0) {
    return {
      partials: {},
      normalPartials: [],
      folderPartials: [],
      duplicates: [],
      folderDuplicates: []
    }
  }

  const partials = {}
  const foldersByPath = {}
  const normalPartials = []
  const duplicates = []
  const duplicatesByPartial = new Map()

  files.forEach(file => {
    const extension = path.extname(file)
    const partialName = path.basename(file, extension).replace(/^_/, '')
    const folderPath = path.dirname(file)
    const folderName = path.basename(folderPath)

    if (partials[partialName]) {
      if (!duplicatesByPartial.has(partialName)) {
        duplicatesByPartial.set(partialName, {
          name: partialName,
          registered: partials[partialName].file,
          duplicates: []
        })
      }

      duplicatesByPartial.get(partialName).duplicates.push(file)
      duplicates.push({
        name: partialName,
        registered: partials[partialName].file,
        duplicate: file
      })

      if (!foldersByPath[folderPath]) {
        foldersByPath[folderPath] = { folderName, partials: [], hasDuplicates: false }
      }
      foldersByPath[folderPath].hasDuplicates = true
      foldersByPath[folderPath].partials.push(`{{> ${partialName}}}`)
      return
    }

    const partialTemplate = (fs.readFileSync(file, 'utf8').trim()) + '\n'

    partials[partialName] = {
      template: partialTemplate,
      file
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
          duplicates: []
        })
      }

      folderDuplicatesByName.get(folderPartialName).duplicates.push(folderPath)
      folderDuplicates.push({
        name: folderPartialName,
        registered: registered.path,
        duplicate: folderPath
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
    duplicates: Array.from(duplicatesByPartial.values())
      .map(item => ({ ...item, duplicates: item.duplicates.sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    folderDuplicates: Array.from(folderDuplicatesByName.values())
      .map(item => ({ ...item, duplicates: item.duplicates.sort() }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}

// Print the list of duplicates
// @param {string} title - The title to show before the list
// @param {array} items - The list of duplicates to show
const printDuplicates = (title, items) => {
  if (items.length === 0) return

  console.log(chalk.yellow(title))
  items.forEach(item => {
    console.log(`  - {{> ${item.name}}}`)
    console.log(`      registered: ${item.registered}`)
    item.duplicates.forEach(duplicate => {
      console.log(`      duplicate:  ${duplicate}`)
    })
  })
  console.log('')
}

// Print the list of partials
// @param {string} title - The title to show before the list
// @param {array} items - The list of partials to show
const printPartialsList = (title, items) => {
  console.log(chalk.blue(title))

  if (items.length === 0) {
    console.log('  There are no partials registered of this type.')
    console.log('')
    return
  }

  items.forEach(item => console.log(`  - {{> ${item}}}`))
  console.log('')
}

// Load partials and return an object with the partials content
// @param {string} input - The input directory
// @return object
export const loadPartials = (input) => {
  const { partials, duplicates, folderDuplicates } = collectPartials(input)

  printDuplicates(`${chalk.yellow('[Warning]')} Conflicts (duplicates):`, duplicates)
  printDuplicates(`${chalk.yellow('[Warning]')} Conflicts (folder duplicates):`, folderDuplicates)

  return Object.fromEntries(Object.entries(partials)
    .map(([key, value]) => [key, value.template]))
}

// Load partials info and print it to the console
// @param {string} input - The input directory
// @return void
export const loadPartialsInfo = (input) => {
  const { normalPartials, folderPartials, duplicates, folderDuplicates } = collectPartials(input)
  const hamletPartialsList = Object.keys(hamletPartials)

  printPartialsList('Partials (hamlet):', hamletPartialsList.sort())
  printPartialsList('Partials (normal):', normalPartials.sort())
  printPartialsList('Partials (folders):', folderPartials.sort())
  printDuplicates('Conflicts (duplicates):', duplicates)
  printDuplicates('Conflicts (folder duplicates):', folderDuplicates)
}
