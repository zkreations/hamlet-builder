import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'
import { ESLint } from 'eslint'

const baseDir = path.join(process.cwd(), 'src')
const outputDir = path.join(process.cwd(), 'lib/data')

const files = globSync(`${baseDir}/**/*.@(xml|hbs|handlebars)`)

const partials = {}
const folders = {}

files.forEach((file) => {
  const extension = path.extname(file)
  const fileName = path.basename(file, extension)
  const partialName = `super.${fileName}`
  const folderName = path.dirname(file).split(path.sep).pop()

  partials[partialName] = fs.readFileSync(file, 'utf8').trim() + '\n'

  if (!folders[folderName]) {
    folders[folderName] = []
  }

  folders[folderName].push(`{{> ${partialName}}}`)
})

Object.entries(folders).forEach(([folder, partialList]) => {
  partialList.sort()

  if (partialList.length <= 1) {
    return
  }

  const folderPartialName = `super.${folder}`
  partials[folderPartialName] = partialList.join('\n') + '\n'
})

const jsContent = `export const superPartials = ${JSON.stringify(partials, null, 2)}\n`

async function formatWithESLint (code) {
  const eslint = new ESLint({ fix: true })
  const results = await eslint.lintText(code)
  return results[0]?.output || code
}

async function generateFile () {
  const formattedCode = await formatWithESLint(jsContent)
  fs.writeFileSync(path.join(outputDir, 'partials.js'), formattedCode)
  console.log('partials.js has been generated successfully with ESLint formatting!')
}

generateFile().catch(console.error)
