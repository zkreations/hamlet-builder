import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { Command } from 'commander'
import { loadConfigurations } from './config.js'
import { buildMode } from './modes/build.js'
import { infoMode } from './modes/info.js'
import { watchMode } from './modes/watch.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultPkgJson = path.join(__dirname, '../package.json')

const Default = {
  input: './src',
  output: './dist',
  mode: 'development',
}

/**
 * Create and configure the CLI command instance.
 *
 * @param {object} [options]
 * @param {string} [options.cwd] - Current working directory
 * @param {object} [options.pkg] - Package.json data
 * @returns {Command} Commander instance
 */
export function createCli({ cwd = process.cwd(), pkg } = {}) {
  const packageData = pkg || JSON.parse(fs.readFileSync(defaultPkgJson, 'utf-8'))
  const program = new Command()

  program
    .version(packageData.version)
    .description('Build and watch your Hamlet Blogger project')
    .option('-i, --input <input>', 'Input path', Default.input)
    .option('-o, --output <output>', 'Output path', Default.output)
    .option('-m, --mode <mode>', 'Set mode: development or production', Default.mode)
    .option('-w, --watch', 'watches the source files and rebuilds on changes')
    .option('-I, --info', 'Display information about the project')
    .option('-n, --no-minify', 'Disable all minification')
    .option('--no-minify-css', 'Disable minification for CSS')
    .option('--no-minify-js', 'Disable minification for JS')
    .action(async (cliOptions) => {
      const { name, version } = packageData
      const projectRoot = cwd

      const context = {
        paths: {
          root: projectRoot,
          src: path.join(projectRoot, cliOptions.input),
          dist: path.join(projectRoot, cliOptions.output),
        },
        utils: {
          resolve: (...args) => path.join(projectRoot, ...args),
        },
      }

      const resolvedConfig = await loadConfigurations(context)

      const mergedOptions = {
        ...resolvedConfig,
        ...cliOptions,
        cwd: projectRoot,
        input: path.join(projectRoot, cliOptions.input),
        output: path.join(projectRoot, cliOptions.output),
      }

      if (mergedOptions.info) {
        console.warn(`Starting ${chalk.green(`${name}@${version}`)} for generating project information\n`)
        await infoMode(mergedOptions)
        return
      }

      console.warn(`Starting ${chalk.green(`${name}@${version}`)} in ${chalk.blue(mergedOptions.mode)} mode\n`)

      if (!fs.existsSync(mergedOptions.input)) {
        console.error(chalk.red(`Error: ${mergedOptions.input} does not exist`))
        process.exit(1)
      }

      if (mergedOptions.watch) {
        watchMode(mergedOptions)
        return
      }

      await buildMode(mergedOptions)
    })

  return program
}

/**
 * Run CLI with provided command-line arguments.
 *
 * @param {string[]} [argv] - Command line arguments
 * @returns {Promise<Command>} Resolved commander execution
 */
export async function runCli(argv = process.argv) {
  const cli = createCli()
  try {
    return await cli.parseAsync(argv)
  }
  catch (error) {
    console.error(chalk.red('[Fatal Error] Execution failed:'), error.message || error)
    process.exit(1)
  }
}
