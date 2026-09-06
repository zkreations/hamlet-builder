import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { build } from './builder.js'
import { loadConfigurations } from './config.js'
import { buildMode } from './modes/build.js'
import { infoMode } from './modes/info.js'
import { watchMode } from './modes/watch.js'
import { logger, measureTime } from './utils/index.js'

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
      const { version } = packageData
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
        logger.hamlet(version, 'info')
        await infoMode(mergedOptions)
        return
      }

      logger.hamlet(version, mergedOptions.mode)

      if (!fs.existsSync(mergedOptions.input)) {
        logger.error(`Input directory not found: ${mergedOptions.input}`)
        process.exit(1)
      }

      if (mergedOptions.watch) {
        const start = performance.now()
        await build(mergedOptions)
        logger.ready(`in ${measureTime(performance.now(), start)}`)
        watchMode(mergedOptions)
        return
      }

      await buildMode(mergedOptions)
    })

  return program
}

export async function runCli(argv = process.argv) {
  const cli = createCli()
  try {
    return await cli.parseAsync(argv)
  }
  catch (error) {
    if (!error?._logged) {
      logger.error(`Execution failed: ${error.message || error}`)
    }
    process.exit(1)
  }
}
