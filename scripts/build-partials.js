import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
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

  partials[`hamlet.${folder}`] = `${partialList.join('\n')}\n`
})

const content = `// This file is auto-generated. Do not edit it manually.\nexport const hamletPartials = ${JSON.stringify(partials, null, 2)}\n`
fs.writeFileSync(path.join(outputDir, 'partials.js'), content)
console.log('partials.js has been generated successfully!')
