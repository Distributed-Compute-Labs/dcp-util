#! /usr/bin/env node
/**
 *  @file               get-config-value.js
 *                      Utility to query values from dcpConfig. Useful for
 *                      shell/os-level interfaces for DCP tasks.
 *
 *  @author             Wes Garland, wgarland@kingsds.network
 *  @date               Nov 2018
 */
require('dcp-rtlink').init()
const path = require('path')
const process = require('process')

function usage() {
  var progName = path.basename(process.argv[1])
  
  console.log(`
${progName} - Query values from dcpConfig
Copyright (c) 2018-2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} [--showfiles] [--keys] <--all | path.to.config.variable [path.to.config.variable...]>
Example: ${progName} scheduler.location.href
`)
  process.exit(1)
}

if (process.argv.length < 3 || process.argv[2] === '--help') {
  usage()
}

const dcpConfig = require('dcp/config').load()
let outFn = el => console.log(JSON.stringify(el, null, 2));
let allMode = false;

for (let i=2; i < process.argv.length; i++) {
  while (process.argv[i].match(/^--/)) {
    switch(process.argv[i]) {
    case '--showfiles':
      console.log('Files loaded:\n - ' + require('config').loadedFiles.join('\n - ') + '\n');
      break;
    case '--all':
      outFn(dcpConfig);
      allMode = true
      break;
    case '--keys':
      outFn = function(arg) { console.log(Object.keys(arg)) };
      break;
    }
    process.argv.splice(i--, 1);
  }
}

if (allMode) {
  outFn(dcpConfig)
} else {
  for (let i=2; i < process.argv.length; i++) {
    let entries = process.argv[i].split('.');
    let entry;
    for (entry = dcpConfig; entries.length; entry = entry[entries.shift()]){
      if (!entry) {
        entry = undefined;
        break;
      }
    }
    outFn(entry);
  }
}
