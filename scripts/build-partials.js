import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { ESLint } from 'eslint'
import { globSync } from 'glob'

const baseDir = path.join(process.cwd(), 'src')
const outputDir = path.join(process.cwd(), 'lib/data')

const files = globSync(`${baseDir}/**/*.@(xml|hbs|handlebars)`)

const partials = {}
const folders = {}

files.forEach((file) => {
  const extension = path.extname(file)
  const fileName = path.basename(file, extension)
  const partialName = `hamlet.${fileName}`
  const folderName = path.dirname(file).split(path.sep).pop()

  partials[partialName] = `${fs.readFileSync(file, 'utf8').trim()}\n`

  if (!folders[folderName]) {
    folders[folderName] = []
  }

  folders[folderName].push(`{{> ${partialName}}}`)
})

Object.entries(folders).forEach(([folder, partialList]) => {
  partialList.sort()

  if (partialList.length === 0) {
    return
  }

  const folderPartialName = `hamlet.${folder}`
  partials[folderPartialName] = `${partialList.join('\n')}\n`
})

const jsContent = `export const hamletPartials = ${JSON.stringify(partials, null, 2)}\n`

async function formatWithESLint(code) {
  const eslint = new ESLint({ fix: true })
  const results = await eslint.lintText(code)
  return results[0]?.output || code
}

async function generateFile() {
  const formattedCode = await formatWithESLint(jsContent)
  fs.writeFileSync(path.join(outputDir, 'partials.js'), formattedCode)
  console.log('partials.js has been generated successfully with ESLint formatting!')
}

generateFile().catch(console.error)
