import path from 'node:path'
import process from 'node:process'
import chalk from 'chalk'
import { analyzePartials } from '../partials/analyzer.js'
import { printDuplicates } from '../partials/collector.js'
import builtInHelpers from '../templates/helpers.js'

const SEPARATOR = chalk.gray('─'.repeat(50))

function printSeparator() {
  console.warn(SEPARATOR)
  console.warn('')
}

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

function printHelpers(customHelpers) {
  const builtInCount = Object.keys(builtInHelpers).length
  const customCount = Object.keys(customHelpers).length
  console.warn(`Helpers: ${builtInCount} built-in · ${customCount} custom`)
}

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

function printSummary({ hamlet, normal, folders, plugins, conflicts, unused }) {
  const total = hamlet + normal + folders + plugins
  const detail = `${hamlet} hamlet · ${normal} normal · ${folders} folders · ${plugins} plugins`
  console.warn(`Partials: ${total} (${detail})  ·  Conflicts: ${conflicts}  ·  Unused: ${unused}`)
  console.warn('')
}

/**
 * Print complete partials information to console.
 *
 * @param {object} options - Hamlet options
 */
export async function printPartialsInfo(options) {
  const analysis = await analyzePartials(options)
  const {
    hamletPartials: hamlet,
    normalPartialsByFolder,
    folderPartialsInfo,
    pluginPartials,
    unused,
    duplicates,
    folderDuplicates,
    normalPartials,
    folderPartials,
  } = analysis

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
