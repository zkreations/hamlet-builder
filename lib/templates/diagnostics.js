import path from 'node:path'
import process from 'node:process'

export function parseErrorLocation(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string')
    return null

  const lineMatch = errorMessage.match(/Parse error on line (\d+):/)
  if (!lineMatch)
    return null

  const line = Number.parseInt(lineMatch[1], 10)
  const lines = errorMessage.split('\n')
  const caretLineIdx = lines.findIndex(l => /^-+\^/.test(l))
  let column = 1

  if (caretLineIdx !== -1) {
    const caretLine = lines[caretLineIdx]
    column = caretLine.indexOf('^') + 1
  }

  return { line, column }
}

export function walkAst(node, visitor) {
  if (!node || typeof node !== 'object')
    return false

  const shouldStop = visitor(node)
  if (shouldStop)
    return true

  if (Array.isArray(node.body)) {
    for (const child of node.body) {
      if (walkAst(child, visitor))
        return true
    }
  }

  if (node.program && walkAst(node.program, visitor))
    return true
  if (node.inverse && walkAst(node.inverse, visitor))
    return true

  if (Array.isArray(node.params)) {
    for (const param of node.params) {
      if (walkAst(param, visitor))
        return true
    }
  }

  if (node.hash?.pairs) {
    for (const pair of node.hash.pairs) {
      if (walkAst(pair.value, visitor))
        return true
    }
  }

  return false
}

export function findPartialCallInAst(ast, partialName, occurrenceIndex = 0) {
  if (!ast)
    return null

  let count = 0
  let foundLoc = null

  walkAst(ast, (node) => {
    if (node.type === 'PartialStatement' || node.type === 'PartialBlockStatement') {
      const name = node.name?.original || node.name?.parts?.[0]
      if (name === partialName) {
        if (count === occurrenceIndex) {
          if (node.loc?.start) {
            foundLoc = {
              line: node.loc.start.line,
              column: node.loc.start.column,
            }
          }
          return true
        }
        count++
      }
    }
    return false
  })

  return foundLoc
}

export function findHelperCallInAst(ast, helperName, occurrenceIndex = 0) {
  if (!ast)
    return null

  let count = 0
  let foundLoc = null

  walkAst(ast, (node) => {
    if (node.type === 'MustacheStatement' || node.type === 'BlockStatement' || node.type === 'SubExpression') {
      const name = node.path?.original || node.path?.parts?.[0]
      if (name === helperName) {
        if (count === occurrenceIndex) {
          if (node.loc?.start) {
            foundLoc = {
              line: node.loc.start.line,
              column: node.loc.start.column,
            }
          }
          return true
        }
        count++
      }
    }
    return false
  })

  return foundLoc
}

function normalizeFilePath(file) {
  if (!file)
    return file
  return path.relative(process.cwd(), file).replaceAll('\\', '/')
}

export function formatLocation(file, loc) {
  const norm = normalizeFilePath(file)
  if (loc && loc.line != null) {
    return `${norm}:${loc.line}:${loc.column ?? 0}`
  }
  return norm
}

export function formatHandlebarsDiagnostic({
  error,
  rootFile,
  rootAst,
}) {
  const message = error?.message || String(error)
  const normRoot = normalizeFilePath(rootFile)

  if (error?.file) {
    const loc = error.line != null ? { line: error.line, column: error.column } : null
    const location = formatLocation(error.file, loc)
    return {
      message,
      location,
      inclusionStack: [],
      fullLocation: [location],
    }
  }

  const parseLoc = parseErrorLocation(message)
  const renderStack = error?.__renderStack || []

  if (parseLoc && renderStack.length === 0) {
    const location = formatLocation(normRoot, parseLoc)
    return {
      message,
      location,
      inclusionStack: [],
      fullLocation: [location],
    }
  }

  if (renderStack.length > 0) {
    const currentFrame = renderStack[renderStack.length - 1]
    let errorLoc = null

    const missingPartialMatch = message.match(/The partial (.+) could not be found/)
    if (missingPartialMatch) {
      const missingName = missingPartialMatch[1]
      if (currentFrame.ast) {
        errorLoc = findPartialCallInAst(currentFrame.ast, missingName)
      }
    }
    else if (error?.__activeHelper && currentFrame.ast) {
      errorLoc = findHelperCallInAst(currentFrame.ast, error.__activeHelper)
    }

    const primaryLocation = formatLocation(currentFrame.file, errorLoc)

    const inclusionStack = []
    for (let i = renderStack.length - 1; i >= 0; i--) {
      const parentFrame = i > 0 ? renderStack[i - 1] : null
      const frame = renderStack[i]
      if (parentFrame) {
        let parentCallLoc = frame.callSite
        if (!parentCallLoc && parentFrame.ast) {
          parentCallLoc = findPartialCallInAst(parentFrame.ast, frame.name)
        }
        const parentLocStr = formatLocation(parentFrame.file, parentCallLoc)
        inclusionStack.push(`included from ${parentLocStr}`)
      }
    }

    return {
      message,
      location: primaryLocation,
      inclusionStack,
      fullLocation: [primaryLocation, ...inclusionStack],
    }
  }

  const missingInRootMatch = message.match(/The partial (.+) could not be found/)
  if (missingInRootMatch && rootAst) {
    const missingName = missingInRootMatch[1]
    const rootLoc = findPartialCallInAst(rootAst, missingName)
    const location = formatLocation(normRoot, rootLoc)
    return {
      message,
      location,
      inclusionStack: [],
      fullLocation: [location],
    }
  }

  return {
    message,
    location: normRoot,
    inclusionStack: [],
    fullLocation: [normRoot],
  }
}
