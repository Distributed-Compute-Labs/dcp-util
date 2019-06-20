#! /usr/bin/env node
/**
 *  @file               get-config-value.js
 *                      Utility to query values from dcpConfig. Useful for
 *                      shell/os-level interfaces for DCP tasks.
 *
 *  @author             Wes Garland, wgarland@kingsds.network
 *  @date               Nov 2018
 */
require('dcp-rtlink/rtLink').link(module.paths)
const path = require('path')
const process = require('process')

function usage() {
  var progName = path.basename(process.argv[1])
  
  console.log(`
${progName} - Query values from dcpConfig
Copyright (c) 2018-2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} [--showfiles] path.to.config.variable [path.to.config.variable...]
Example: ${progName} scheduler.hostname
`)
  process.exit(1)
}

if (process.argv.length < 3 || process.argv[2] === '--help') {
  usage()
}

const dcpConfig = require('config').load()

if (process.argv[2] === '--showfiles') {
  console.log('Files loaded:\n - ' + require('config').loadedFiles.join('\n - ') + '\n')
  process.argv.splice(2,1)
}

for (let i=2; i < process.argv.length; i++) {
  let entries = process.argv[i].split('.')
  let entry
  for (entry = dcpConfig; entries.length; entry = entry[entries.shift()]){
    debugger
  }
  console.log(entry)
}
