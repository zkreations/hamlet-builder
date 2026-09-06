import { compileStyle } from './compilers/css.js'
import { compileJS } from './compilers/js.js'
import { compileXML } from './compilers/xml.js'

export async function build(options) {
  await Promise.all([
    compileJS(options),
    compileStyle(options),
  ])

  await compileXML(options)
}
