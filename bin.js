#!/usr/bin/env node
'use strict'
import chalk from 'chalk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { program } from 'commander'

import { buildMode } from './lib/modes/build-mode.js'
import { watchMode } from './lib/modes/watch-mode.js'
import { config } from './lib/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgJson = path.join(__dirname, './package.json')
const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'))

const userPath = process.cwd()

// Default options
const Default = {
  input: './src',
  output: './dist',
  mode: 'development'
}

program
  .version(pkg.version)
  .description('Build and watch your project')
  .option('-i, --input <input>', 'Input path', Default.input)
  .option('-o, --output <output>', 'Output path', Default.output)
  .option('-m, --mode <mode>', 'Set mode: development or production', Default.mode)
  .option('-w, --watch', 'watches the source files and rebuilds on changes')
  .option('-n, --no-minify', 'Disable all minification')
  .option('-c, --no-minify-css', 'Disable minification for CSS')
  .option('-j, --no-minify-js', 'Disable minification for JS')
  .action(async (options) => {
    const { name, version } = pkg

    Object.assign(options, config, {
      input: path.join(userPath, options.input),
      output: path.join(userPath, options.output)
    })

    // Log the version and mode
    console.log(`Starting ${chalk.green(`${name}@${version}`)} in ${chalk.blue(options.mode)} mode\n`)

    // Check if input directory exists
    if (!fs.existsSync(options.input)) {
      console.error(chalk.red(`Error: ${options.input} does not exist`))
      process.exit(1)
    }

    if (options.watch) {
      watchMode(options)
      return
    }

    await buildMode(options)
  })
  .parse(process.argv)
