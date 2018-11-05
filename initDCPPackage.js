#!/usr/bin/env node
/**
 *  @file       init.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Utility for creating a package.dcp module descriptor
 *
 *  @author     Greg Agnew, gagnew@sparc.network
 *  @date       May 2018
 */

require('dcp-rtlink/rtLink').link(module.paths)
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const moduleDeclareRegex = /module *\. *declare *[()]/

var topLevelDirectory = null;  /* All modules in package must be below here on the filesystem */

var packageJSON = {
  name: '',
  version: '0.0.0',
  files: {}
}

var questions = [
  ['Name of the package', 'name'],
  ['Version of the package', 'version']
]

var no = (answer) => {
  return (answer === 'no' || answer === 'n' || answer.length === 0)
}

var yes = (answer) => {
  return !no(answer)
}

var showCurrentFiles = () => {
  if (Object.keys(packageJSON.files).length > 0) {
    console.log('Current Files:')
    console.log(JSON.stringify(packageJSON.files, null, 2))
  }
}

/**
 * Resolve a module identifer into a disk path, when possible.  Does not search (require|module).paths;
 * rather, top-level moduleIdentifiers are resolved as null.  The current working directory is treated
 * as the parent module's directory.
 *
 * @throws if a non-top-level moduleIdentifier does not resolve to a file that exists
 */
function locateModule(moduleIdentifier) {
  if (!/^[.\/.]/.exec(moduleIdentifier))
    return null

  return require.resolve(path.resolve(moduleIdentifier))
}

var ask = (index) => {
  let field = questions[index][1]
  rl.question(questions[index][0] + ' (' + packageJSON[field] + '): ', answer => {
    if (answer.length > 0) packageJSON[field] = answer
    if (++index < questions.length) ask(index)
    else askFilesFromModule()
  })
}

// Asks the user if they want to deploy a module and it's dependencies
var askFilesFromModule = () => {
  showCurrentFiles()
  rl.question('Recursively add dependencies for a given module (yes/no): ', answer => {
    answer = answer.toLowerCase()
    if (no(answer)) {
      files()
      return
    }
    rl.question('Include given module in the package (yes/no): ', answer => {
      let includeGiven = yes(answer)
      rl.question('Path to module: ', modulePath => {
	if (modulePath.charAt(0) != '.' && modulePath.charAt(0) != '/') {
	  if (!topLevelDirectory)
	    topLevelDirectory = process.cwd()
	  modulePath = topLevelDirectory + '/' + modulePath
	} else {
	  if (!topLevelDirectory) {
	    topLevelDirectory = path.dirname(modulePath)
	  }
	}
        modulePath = locateModule(modulePath)
        let moduleFiles = getDepsForGivenModule(modulePath, includeGiven)
        for (let key in moduleFiles) {
          let file = moduleFiles[key]
          packageJSON.files[file.path] = file.deployPath
        }
        askFilesFromModule()
      })
    })
  })
}

// Takes a given module and gets all of its dependencies and returns them
var getDepsForGivenModule = (given, includeGiven = false) => {
  let moduleDir = path.dirname(given) || '.'
  let filePaths = {}
  let paths = []

  process.chdir(moduleDir)

  if (includeGiven) {
    paths.unshift(given)
  } else {
    paths = paths.concat(getDepsFromModule(given))
  }

  while (paths.length) {
    let aPath = paths.shift()
    if (filePaths[aPath]) { continue }
    if (!aPath.startsWith(topLevelDirectory + '/') && aPath !== given) { continue }
    filePaths[aPath] = {
      path: aPath,
      deployPath: aPath.slice(topLevelDirectory.length + 1) /* Deploy path below the package's top level directory */
    }
    paths = paths.concat(getDepsFromModule(aPath))
  }

  process.chdir(topLevelDirectory)
  return filePaths
}

// Takes a path to a module and attempts to fetch it's dependencies and returns them
var getDepsFromModule = (modulePath) => {
  let deps = []
  let exists = fs.existsSync(modulePath)
  if (!exists) {
    console.error(`Error: The module file (${modulePath}) does not exist.`)
    process.exit(1)
  }

  let moduleString = fs.readFileSync(modulePath).toString()
  if (!moduleString.match(moduleDeclareRegex)) {
    console.error(`Error: The module file (${modulePath}) does not contain a 'module.declare' statement.`)
    process.exit(1)
  }

  let indirectEval = eval
  moduleString = moduleString.replace(moduleDeclareRegex, 'return module.declare(')
  let fn = indirectEval('(function(module){ ' + moduleString + '})')
  let fakeModule = {
    declare: function fakeDeclare (deps, factory) {
      if (Array.isArray(deps)) return deps
      else return []
    }
  }
  process.chdir(path.dirname(modulePath))
  deps = fn(fakeModule)
    .map(function (el) { return locateModule(el) })
    .filter(function (el) { return el !== null })
  process.chdir(topLevelDirectory)

  return deps
}

var files = () => {
  showCurrentFiles()
  rl.question('Add file To deployment: ', filepath => {
    if (filepath.length === 0) {
      write()
    } else {
      packageJSON.files[filepath] = ''
      rl.question('Deploy to path (' + filepath + '): ', deploypath => {
        if (filepath.length > 0) packageJSON.files[filepath] = deploypath
        files()
      })
    }
  })
}

var write = () => {
  fs.writeFileSync('package.dcp', JSON.stringify(packageJSON, null, 2))
  process.exit()
}

fs.stat('package.dcp', (error, status) => {
  if (!error) {
    packageJSON = JSON.parse(fs.readFileSync('package.dcp'))
  }
  ask(0)
})
