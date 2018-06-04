/**
 *  @file       init.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Utility for creating a package.dcp module descriptor
 *
 *  @author     Greg Agnew, gagnew@sparc.network
 *  @date       May 2018
 */

const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

var packageJSON = {
  name: '',
  version: '0.0.0',
  files: {}
}

var questions = [
  ['Name of the package', 'name'],
  ['Version of the package', 'version']
]

var ask = (index) => {
  let field = questions[index][1]
  rl.question(questions[index][0] + ' (' + packageJSON[field] + '): ', answer => {
    if (answer.length > 0) packageJSON[field] = answer
    if (++index < questions.length) ask(index)
    else files()
  })
}

var files = () => {
  if (Object.keys(packageJSON.files).length > 0) {
    console.log('Current Files:')
    console.log(JSON.stringify(packageJSON.files, null, 2))
  }

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
