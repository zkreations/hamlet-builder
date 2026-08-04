import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import chalk from 'chalk'
import { globSync } from 'glob'
import { collectPartials } from './load-partials.js'
import { loadPlugins } from './load-plugins.js'
import helpers from './template-helpers.js'

const SEPARATOR = chalk.gray('─'.repeat(50))

// Print a separator line
function printSeparator() {
  console.warn(SEPARATOR)
  console.warn('')
}

// Print the config section
// @param {object} options - The options object
function printConfig(options) {
  const toRelative = p => `./${path.relative(process.cwd(), p)}`

  console.warn(chalk.blue('Config:'))
  console.warn('')
  console.warn(`  - input: ${toRelative(options.input)}`)
  console.warn(`  - output: ${toRelative(options.output)}`)
  console.warn(`  - mode: ${options.mode}`)
  console.warn(`  - minifyCss: ${options.minifyCss ?? true}`)
  console.warn(`  - minifyJs: ${options.minifyJs ?? true}`)
  console.warn(`  - recompileOnAnyChange: ${options.hamlet?.recompileOnAnyChange ?? false}`)
  console.warn('')
}

// Print the hamlet partials section
// @param {string[]} items - Sorted list of hamlet partial names
function printHamletPartials(items) {
  console.warn(chalk.blue(`Partials (hamlet): ${items.length}`))
  console.warn('')

  if (items.length === 0) {
    console.warn('  There are no hamlet partials registered.')
    console.warn('')
    return
  }

  items.forEach(item => console.warn(`  - {{> ${item}}}`))
  console.warn('')
}

// Print normal partials grouped by folder
// @param {object} normalPartialsByFolder - { folderName: [partialName, ...] }
function printNormalPartialsByFolder(normalPartialsByFolder) {
  const total = Object.values(normalPartialsByFolder).reduce((sum, arr) => sum + arr.length, 0)

  console.warn(chalk.blue(`Partials (normal): ${total}`))
  console.warn('')

  if (total === 0) {
    console.warn('  There are no normal partials registered.')
    console.warn('')
    return
  }

  for (const [folderPath, partials] of Object.entries(normalPartialsByFolder)) {
    console.warn(`  ${folderPath}`)
    partials.forEach(name => console.warn(`  - {{> ${name}}}`))
    console.warn('')
  }
}

// Print folder partials with count and path
// @param {object[]} items - [{ name, folderPath, count }]
function printFolderPartialsInfo(items) {
  console.warn(chalk.blue(`Partials (folders): ${items.length}`))
  console.warn('')

  if (items.length === 0) {
    console.warn('  There are no folder partials registered.')
    console.warn('')
    return
  }

  const maxTagLen = Math.max(...items.map(f => `{{> ${f.name}}}`.length))

  items.forEach(({ name, folderPath, count }) => {
    const tag = `{{> ${name}}}`
    const pad = ' '.repeat(maxTagLen - tag.length + 2)
    const countStr = String(count).padStart(2)
    console.warn(`  - ${tag}${pad}${countStr} partials  →  ${folderPath}`)
  })

  console.warn('')
}

// Print plugin partials grouped by namespace
// @param {object} pluginPartials - { partialName: template }
function printPluginPartials(pluginPartials) {
  const entries = Object.entries(pluginPartials)

  console.warn(chalk.blue(`Partials (plugins): ${entries.length}`))
  console.warn('')

  if (entries.length === 0) {
    console.warn('  There are no plugin partials registered.')
    console.warn('')
    return
  }

  const byNamespace = {}
  for (const [name] of entries) {
    const namespace = name.split('.')[0]
    if (!byNamespace[namespace])
      byNamespace[namespace] = []
    byNamespace[namespace].push(name)
  }

  for (const [namespace, names] of Object.entries(byNamespace)) {
    console.warn(`  ${namespace} (${names.length})`)
    names.forEach(name => console.warn(`  - {{> ${name}}}`))
    console.warn('')
  }
}

// Print the helpers summary
// @param {object} customHelpers - Custom helpers from hamlet config
function printHelpers(customHelpers) {
  const builtInCount = Object.keys(helpers).length
  const customCount = Object.keys(customHelpers).length
  console.warn(`Helpers: ${builtInCount} built-in · ${customCount} custom`)
}

// Print the list of unused partials
// @param {object[]} unused - [{ name, origin }]
function printUnused(unused) {
  console.warn(chalk.blue(`Unused: ${unused.length}`) + chalk.gray('  (Static analysis may not detect dynamic references)'))
  console.warn('')

  if (unused.length === 0) {
    console.warn('  All partials are referenced.')
    console.warn('')
    return
  }

  const maxLen = Math.max(...unused.map(u => `{{> ${u.name}}}`.length))

  unused.forEach(({ name, origin }) => {
    const tag = `{{> ${name}}}`
    const pad = ' '.repeat(maxLen - tag.length + 2)
    console.warn(`  - ${tag}${pad}${origin}`)
  })

  console.warn('')
}

// Print the summary line
// @param {object} counts - { hamlet, normal, folders, plugins, conflicts, unused }
function printSummary({ hamlet, normal, folders, plugins, conflicts, unused }) {
  const total = hamlet + normal + folders + plugins
  const detail = `${hamlet} hamlet · ${normal} normal · ${folders} folders · ${plugins} plugins`
  console.warn(`Partials: ${total} (${detail})  ·  Conflicts: ${conflicts}  ·  Unused: ${unused}`)
  console.warn('')
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

// Build a combined search corpus from main files, partials and plugin partials
// @param {string} input - The input directory
// @param {object} partials - Collected partials from collectPartials
// @param {object} pluginPartials - Plugin partials from loadPlugins
// @return string
async function buildSearchCorpus(input, partials, pluginPartials) {
  const mainFiles = globSync(`${input}/**/!(_)*.@(xml|hbs|handlebars)`)
  const mainContents = await Promise.all(mainFiles.map(f => fs.readFile(f, 'utf8')))

  const partialTemplates = Object.values(partials).map(p => p.template ?? '')
  const pluginTemplates = Object.values(pluginPartials)

  return [...mainContents, ...partialTemplates, ...pluginTemplates].join('\n')
}

// Extract all partial references from the search corpus
// @param {string} corpus - The combined search corpus
// @return Set<string>
function extractReferences(corpus) {
  const RE = /\{\{#?>\s*([\w./-]+)/g
  const refs = new Set()

  let match = RE.exec(corpus)

  while (match !== null) {
    refs.add(match[1].trim())
    match = RE.exec(corpus)
  }

  return refs
}

// Find partials that are not referenced anywhere in the corpus
// @param {object} normalPartialsByFolder - { folderName: [partialName, ...] }
// @param {object[]} folderPartialsInfo - [{ name, folderPath, count }]
// @param {object} pluginPartials - { partialName: template }
// @param {Set<string>} refs - Extracted references from the corpus
// @return array
function findUnusedPartials(normalPartialsByFolder, folderPartialsInfo, pluginPartials, refs) {
  const unused = []

  for (const [folder, names] of Object.entries(normalPartialsByFolder)) {
    for (const name of names) {
      if (!refs.has(name))
        unused.push({ name, origin: `${folder}/` })
    }
  }

  for (const { name, folderPath } of folderPartialsInfo) {
    if (!refs.has(name))
      unused.push({ name, origin: folderPath })
  }

  for (const name of Object.keys(pluginPartials)) {
    if (!refs.has(name))
      unused.push({ name, origin: `${name.split('.')[0]} (plugin)` })
  }

  return unused
}

// Load partials info and print it to the console
// @param {object} options - The options object
// @return void
export async function loadPartialsInfo(options) {
  const {
    partials,
    normalPartialsByFolder,
    folderPartialsInfo,
    duplicates,
    folderDuplicates,
    hamletPartials: hamlet,
    normalPartials,
    folderPartials,
  } = await collectPartials(options.input)

  const pluginsConfig = Array.isArray(options.hamlet?.plugins) ? options.hamlet.plugins : []
  const { partials: pluginPartials } = await loadPlugins(pluginsConfig, { partials })

  const corpus = await buildSearchCorpus(options.input, partials, pluginPartials)
  const refs = extractReferences(corpus)
  const unused = findUnusedPartials(normalPartialsByFolder, folderPartialsInfo, pluginPartials, refs)

  printConfig(options)
  printSeparator()

  printHamletPartials(hamlet.sort())
  printSeparator()

  printNormalPartialsByFolder(normalPartialsByFolder)
  printSeparator()

  printFolderPartialsInfo(folderPartialsInfo)
  printSeparator()

  printPluginPartials(pluginPartials)
  printSeparator()

  printUnused(unused)
  printSeparator()

  const allDuplicates = [...duplicates, ...folderDuplicates]

  if (allDuplicates.length > 0) {
    printDuplicates(`${chalk.yellow('[Warning]')} Conflicts:`, allDuplicates)
    printSeparator()
  }

  printHelpers(options.hamlet?.helpers ?? {})

  printSummary({
    hamlet: hamlet.length,
    normal: normalPartials.length,
    folders: folderPartials.length,
    plugins: Object.keys(pluginPartials).length,
    conflicts: allDuplicates.length,
    unused: unused.length,
  })
}
