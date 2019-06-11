#! /usr/bin/env node
/**
 * @file        makeWebConfig.js        Extract relevant configuration information from
 *                                      this host and format it to be usable from the web
 *                                      content via script tag.
 *
 * @author      Wes Garland, wes@kingsds.network
 * @date        July 2018
 */
require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()

const process = require('process')
const path = require('path')
let   outputFilename = dcpConfig.installLocation + '/www/docs/etc/dcp-config.js'

/* Only properties whose names String.match a whiteList will be emitted into
 * the web-facing config file (www/docs/etc/dcp-config.js) when creating a
 * safe subset.
 *
 * Two whitelists are considered for each property:
 *  - default: considered for all properties
 *  - someName: considered for properties of dcpConfig.someName.
 */
const whiteLists = {
  default: [ 'location', 'isDown', 'useBlockchain', /[a-z]U[rR][lL]$/ ]
}

/** Generate the safe subset (whitelisted properties) of a property of dcpConfig.
 *
 *  @param      label           the name of the top level property (e.g. 'scheduler')
 *  @returns    an object containing the safe subset
 */
function safeSubset(label) {
  var copy = {}
  var o = dcpConfig[label]
  var whiteList = whiteLists[label]
  var p, tmp

  if (!whiteList)
    whiteList = whiteLists.default

  for (p in o) {
    if (o.hasOwnProperty(p)) {
      for (let i = 0; i < whiteList.length; i++) {
        switch (typeof whiteList[i]) {
        case 'string':
          if (whiteList[i] === p) {
            copy[p] = o[p]
          }
        case 'object':
          if (whiteList[i] instanceof RegExp && p.match(whiteList[i])) {
            copy[p] = o[p]
          }
          break
        case 'function':
          if ((tmp = whiteList[i](p))) {
            copy[p] = tmp
          }
          break
        }
      }
    }
  }

  return copy
}

/** This object becomes the web config JSON that is loaded by SCRIPT tag in apps */
var webConfig = {
  scheduler: safeSubset('scheduler'),
  packageManager: safeSubset('packageManager'),
  storage: safeSubset('storage'),
  global: safeSubset('global'),
  bank: safeSubset('bank'),
  portal: safeSubset('portal'),
  terminal: safeSubset('terminal')
}

/** Main program entry point */
function main(argv) {
  let quiet = false
  let exitCode = 0
  
  for (let optind = 1; optind < argv.length; optind++)
    switch(argv[optind]) {
    default:
      exitCode = 1  
    case '--help': 
    case '-h':
      console.log(`
${path.basename(argv[0])} - Create dcpConfig for external hosts.
Copyright (c) 2018-2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage: ${path.basename(argv[0])} [options] [-o filename]
Where:
  • The default behaviour is to create the output file, ${outputFilename}
  • --help or -h displays this help
  • --quiet or -q suppresses all non-error output
  • -o filename specifies an alternate output filename
  • --showfiles dumps the list of config files which would be distilled into the 
    output file before exiting
`)
      process.exit(exitCode)
      break
    case '--showfiles':
      console.log('Files loaded:\n - ' + require('config').loadedFiles.join('\n - ') + '\n')
      console.log('Output file:', outputFilename)
      process.exit(0)
    case '-o':
      outputFilename = argv[optind + 1]
      optind++
      break
    case '-q': case '--quiet': 
      quiet = true
      break
  }

  if (!quiet)
    console.log(' * Creating ' + outputFilename)
  require('fs').writeFileSync(outputFilename, 'var dcpConfig = ' + JSON.stringify(webConfig), 'utf-8')
}
main(process.argv.slice(1))
