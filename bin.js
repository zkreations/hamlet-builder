#!/usr/bin/env node
'use strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { program } from 'commander'

import { config } from './lib/config.js'
import { buildMode } from './lib/modes/build-mode.js'
import { infoMode } from './lib/modes/info-mode.js'
import { watchMode } from './lib/modes/watch-mode.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgJson = path.join(__dirname, './package.json')
const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'))

const userPath = process.cwd()

const Default = {
  input: './src',
  output: './dist',
  mode: 'development',
}

program
  .version(pkg.version)
  .description('Build and watch your project')
  .option('-i, --input <input>', 'Input path', Default.input)
  .option('-o, --output <output>', 'Output path', Default.output)
  .option('-m, --mode <mode>', 'Set mode: development or production', Default.mode)
  .option('-w, --watch', 'watches the source files and rebuilds on changes')
  .option('-I, --info', 'Display information about the project')
  .option('-n, --no-minify', 'Disable all minification')
  .option('--no-minify-css', 'Disable minification for CSS')
  .option('--no-minify-js', 'Disable minification for JS')
  .action(async (options) => {
    const { name, version } = pkg
    const resolvedConfig = await config

    Object.assign(options, resolvedConfig, {
      input: path.join(userPath, options.input),
      output: path.join(userPath, options.output),
    })

    if (options.info) {
      console.warn(`Starting ${chalk.green(`${name}@${version}`)} for generating project information\n`)
      await infoMode(options)
    }

    console.warn(`Starting ${chalk.green(`${name}@${version}`)} in ${chalk.blue(options.mode)} mode\n`)

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
