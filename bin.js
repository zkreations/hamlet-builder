#!/usr/bin/env node
'use strict'
import chalk from 'chalk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { program } from 'commander'

import { buildMode } from './lib/modes/build-mode.js'
import { watchMode } from './lib/modes/watch-mode.js'

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
  .option('--no-minify', 'Disable minification')
  .action(async (options) => {
    const input = path.join(userPath, options.input)
    const output = path.join(userPath, options.output)
    const { name, version } = pkg

    // Log the version and mode
    console.log(`Starting ${chalk.green(`${name}@${version}`)} in ${chalk.blue(options.mode)} mode\n`)

    // Check if input directory exists
    if (!fs.existsSync(input)) {
      console.error(chalk.red(`Error: ${input} does not exist`))
      process.exit(1)
    }

    if (options.watch) {
      watchMode(input, output, options)
      return
    }

    await buildMode(input, output, options)
  })
  .parse(process.argv)
