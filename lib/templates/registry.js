import Handlebars from 'handlebars'
import { hamletPartials } from '../data/partials.js'
import { findPartialCallInAst, parseErrorLocation } from './diagnostics.js'
import { createHelpers } from './helpers.js'

function wrapHelper(name, fn) {
  if (typeof fn !== 'function')
    return fn

  return function wrappedHelper(...args) {
    try {
      return fn.apply(this, args)
    }
    catch (err) {
      if (!err.__activeHelper) {
        err.__activeHelper = name
      }
      throw err
    }
  }
}

export function createHandlebarsEnvironment({
  partials = {},
  helpers = {},
  pluginPartials = {},
  pluginHelpers = {},
  basePath,
  outputPath,
  isDevelopment = false,
} = {}) {
  const hbs = Handlebars.create()
  const renderStack = []
  hbs.__renderStack = renderStack

  const origRegisterHelper = hbs.registerHelper.bind(hbs)
  hbs.registerHelper = function (name, helper) {
    if (typeof name === 'object') {
      for (const [key, fn] of Object.entries(name)) {
        hbs.registerHelper(key, fn)
      }
      return
    }
    origRegisterHelper(name, wrapHelper(name, helper))
  }

  const origRegisterPartial = hbs.registerPartial.bind(hbs)
  hbs.registerPartial = function (name, partial, file) {
    if (typeof name === 'object') {
      const infoMap = name._partialsInfo || {}
      for (const [key, val] of Object.entries(name)) {
        const filePath = infoMap[key]?.file || file || null
        hbs.registerPartial(key, val, filePath)
      }
      return
    }

    let ast = null
    let source = null
    let compiled = typeof partial === 'function' ? partial : null

    if (typeof partial === 'string') {
      source = partial
      try {
        ast = Handlebars.parse(source)
      }
      catch (e) {
        const loc = parseErrorLocation(e.message)
        const err = new Error(e.message)
        err.file = file || name
        err.line = loc?.line
        err.column = loc?.column
        throw err
      }
    }

    function wrappedPartial(context, options) {
      if (!compiled) {
        compiled = hbs.compile(ast || source)
      }

      const callerFrame = renderStack[renderStack.length - 1]
      let callSite = null

      if (callerFrame?.ast) {
        const counts = callerFrame.callCounts
        const count = counts.get(name) || 0
        counts.set(name, count + 1)
        callSite = findPartialCallInAst(callerFrame.ast, name, count)
      }

      const frame = {
        name,
        file,
        source,
        ast,
        callSite,
        callCounts: new Map(),
      }

      renderStack.push(frame)

      try {
        return compiled.call(this, context, options)
      }
      catch (err) {
        if (!err.__renderStack) {
          err.__renderStack = renderStack.map(f => ({ ...f }))
        }
        throw err
      }
      finally {
        renderStack.pop()
      }
    }

    origRegisterPartial(name, wrappedPartial)
  }

  const builtInHelpers = createHelpers({ basePath, outputPath, isDevelopment })
  hbs.registerHelper(builtInHelpers)

  for (const [key, val] of Object.entries(hamletPartials)) {
    hbs.registerPartial(key, val, `[hamlet built-in: ${key}]`)
  }

  if (partials && Object.keys(partials).length > 0) {
    hbs.registerPartial(partials)
  }

  if (helpers && Object.keys(helpers).length > 0) {
    hbs.registerHelper(helpers)
  }

  if (pluginPartials && Object.keys(pluginPartials).length > 0) {
    hbs.registerPartial(pluginPartials)
  }

  if (pluginHelpers && Object.keys(pluginHelpers).length > 0) {
    hbs.registerHelper(pluginHelpers)
  }

  return hbs
}
