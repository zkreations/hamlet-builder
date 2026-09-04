import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const baseDir = path.join(rootDir, 'src').replaceAll('\\', '/')
const outputDir = path.join(rootDir, 'lib/data')

const files = globSync(`${baseDir}/**/*.@(xml|hbs|handlebars)`)

const partials = {}
const folders = {}

files.forEach((file) => {
  const extension = path.extname(file)
  const fileName = path.basename(file, extension)
  const partialName = `hamlet.${fileName}`
  const folderName = path.basename(path.dirname(file))

  const template = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim()
  partials[partialName] = `${template}\n`

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

  partials[`hamlet.${folder}`] = `${partialList.join('\n')}\n`
})

const content = `// This file is auto-generated. Do not edit it manually.\nexport const hamletPartials = ${JSON.stringify(partials, null, 2)}\n`
fs.writeFileSync(path.join(outputDir, 'partials.js'), content)
console.log('partials.js has been generated successfully!')
