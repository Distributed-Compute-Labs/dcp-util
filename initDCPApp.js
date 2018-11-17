#!/usr/bin/env node
/**
 *  @file       initDCPApp.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Utility for creating a package.dcp module descriptor
 *
 *  @author     Greg Agnew, gagnew@sparc.network
 *  @date       Nov 2018
 */

const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

/**
 * Command line options
 *
 * npm start arg1 arg2=val2 arg3 ..
 *
 * EG: npm start dev port=3000
 */

var options = {}
for (let i = 0; i < process.argv.length; i++) {
  let values = process.argv[i].split('=')
  options[values[0]] = values[1] === 'true' ? true : values[1] === 'false' ? false : values[1]
}

var ask = function (question, defaultAnswer, optionKey) {
  return new Promise((resolve, reject) => {
    if (typeof options[optionKey] !== 'undefined') return resolve(options[optionKey])
    if (options.silent) return resolve('')
    rl.question(question + ' (' + defaultAnswer + '): ', answer => {
      if (!answer.length) answer = defaultAnswer
      resolve(answer)
    })
  })
}

var main = async () => {
  let appJSON = {
    name: await ask('Name:', '', 'name'),
    version: await ask('Version:', '0.0.0', 'version'),
    index: await ask('Index Page:', 'index.html', 'index'),
    icon: await ask('Icon', 'icon.png', 'icon')
  }

  let outputLocation = await ask('Output Location:', 'app.dcp', 'output')

  fs.writeFileSync(outputLocation, JSON.stringify(appJSON, null, 2))
  process.exit()
}

main()
