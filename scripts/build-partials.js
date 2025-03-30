import fs from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'

const baseDir = path.join(process.cwd(), 'src')
const outputDir = path.join(process.cwd(), 'lib/data')

const files = globSync(`${baseDir}/**/*.hbs`)

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

fs.writeFileSync(path.join(outputDir, 'partials.js'), jsContent)
console.log('partials.js has been generated successfully!')
