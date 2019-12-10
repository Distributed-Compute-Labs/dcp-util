#! /usr/bin/env node
/**
 *  @file       deploy.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Utility for compiling and deploying DCP Modules from npm repositories
 *
 *              CLI Usage: deployDCPPacakge.js package=package.dcp keystore=myDCPKey.keystore keypass=mypass
 *
 *  @author     Greg Agnew, gagnew@sparc.network
 *  @date       May 2018
 */

require('dcp-rtlink/rtLink').init()
// global.Promise = Promise = require('promiseDebug').init(Promise)

const fs = require('fs')
const process = require('process')
const path = require('path')
const prompts = require('prompts')

// const protocol = require('protocol-node.js')
// require('dcp-client/dist/compute.min.js')
var debug = process.env.DCP_DEBUG || process.env.DEBUG || ''

const argvZero = require('path').basename(__filename)

/**
 * Command line options
 *
 * npm start arg1 arg2=val2 arg3 ..
 *
 * EG: npm start dev port=3000
 */

// Process CLI
const options = require('yargs')
  .usage(`
$0 - Utility to deploy a new/updated DCP package
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

$0 [options]`)
  .alias('help', 'h')
  .hide('version')
  .boolean('network')
  .describe('network', 'Deploy the package to a remote module server')
  .describe('scheduler', 'Scheduler address of the remote DCP system')
  .boolean('local')
  .describe('local', 'Deploy package directly to your local filesystem')
  .describe('deployPath', 'Local path to deploy package')
  // .conflicts('network', 'local')
  .describe('keystore', 'Path to deploying keystore')
  .describe('package', 'Path to package description')
  .default({
    // package: './package.dcp',
    network: true,
    scheduler: 'https://scheduler.distributed.computer',
    local: false,
    deployPath: '/var/dcp/db/packages/',
  })
  .argv;
const entryPoint = options.scheduler;

console.log('Parsed options:')
console.log(options);
process.exit(0);

const usage = () => {
  console.log(`
${argvZero} - Utility to deploy a new/updated DCP package
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:  ${argvZero} OPTIONS

Where:
  --help        Display this usage screen

  --network     Deploy package to package server at ${require('dcp/config').packageManager.location} (default)
  --local       Deploy package directly to local filesystem at 

  --keystore=/path/to/your.keystore
                Path to keystore file (default: ask, look for ./myDCPKey.keystore)
  --package=/path/to/package.dcp
                Path to DCP Package definition (default: ask, look for ./package.dcp)

Environment:
  DEBUG         If truthy, enable debug mode. If a string, treat as a list of extended debug flags
                (eg. DEBUG="verbose protocol" to enable DEBUG mode, with the "verbose" and "protocol" flags)
`)

  // console.log('CLI options:', options)

  process.exit(1)
}

var getFiles = (packageJSON) => {
  let filenames = Object.keys(packageJSON.files)
  let deployPaths = Object.values(packageJSON.files)
  let missingFiles = false
  let deployFiles = {}

  for (let i = 0; i < filenames.length; i++) {
    try {
      deployFiles[deployPaths[i] || filenames[i]] = fs.readFileSync(filenames[i]).toString()
    } catch (error) {
      console.log('Missing File: ' + filenames[i])
      missingFiles = true
    }
  }

  if (!Object.keys(deployFiles).length) {
    console.error('Cannot deploy package with no files')
    process.exit(2)
  }

  if (missingFiles) {
    process.exit(1)
  }

  packageJSON.files = deployFiles
}

var main = async () => {
  console.log(`${argvZero} - Utility to deploy a new/updated DCP package
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.\n`)

  let packageLocation
  if (options['package']) {
    packageLocation = options['package']
  } else {
    const prompt = {
      type: 'text',
      name: 'packageLocation',
      message: 'Location of package file (package.dcp):',
      initial: 'package.dcp'
    }
    const response = await prompts(prompt)
    packageLocation = response.packageLocation
  }

  let status
  try {
    status = fs.statSync(packageLocation)
  } catch (error) {
    console.log('Could not locate package description file. Please run: initDCPPackage.js')
    process.exit(2)
  }

  let packageJSON = JSON.parse(fs.readFileSync(packageLocation))
  getFiles(packageJSON)

  let keystoreLocation = options['keystore'] || undefined;

  const wallet = await require('dcp/wallet').get(keystoreLocation);

  var result = null
  try {
    let r

    if (options['local']) {
      r = await deployLocal(packageJSON, wallet)
    } else {
      r = await deployNetwork(packageJSON, wallet)
    }

    result = r.result
  } catch (error) {
    console.error(error)
    process.exit(1)
  }

  process.exit(0)
}

/// Send the package over the DCP network to deploy via the package-manager server
async function deployNetwork (packageJSON, wallet) {
  let baseURL = options.packageManager || require('dcp/dcp-config').packageManager.location

  let URL = baseURL.resolve('/deploy/module')

  // TODO: take as cli parameter instead of hard coding.
  // URL = 'https://packages.distributed.computer:443/deploy/module'

  console.log(` * Deploying via network to ${URL}...`)

  let result
  try {
    console.log('Sending module to server:', baseURL)
    result = await require('dcp/protocol').send(URL, packageJSON, wallet);
  } catch (error) {
    if (error.hasOwnProperty('remote')) {
      if (error.remote.status === 'error') {
        console.error('Remote Error:', error.remote.error)
        if (debug) { console.log(error.remote) }
      } else {
        console.error('Remote Error:', error.remote)
      }
    } else {
      console.error('Could not send module to server;', error)
    }
    throw error
  }

  // estimate credits cost to deploy
  // ask user for credits etc, note credits loaded etc

  console.log('Response: ')
  console.log(JSON.stringify(result, null, 2))
  console.log(`Module ${packageJSON.name} deployed to ${URL}/${packageJSON.name}`)

  return { status: 'ok', result }
}

/// Directly deploy the package to the local filesystem
async function deployLocal (packageJSON, wallet) {
  let baseURL = require('dcp/dcp-config').packageManager.location
  let URL = baseURL.resolve('/deploy/module')

  const database = require('../lib/database');
  database.init(require('dcp/dcp-config').packageManager.database)

  const libDeployPackage = require('../lib/deploy-package')

  console.log(` * Deploying locally to ${database.getFilePath()}/packages/${packageJSON.name}...`)

  const signedMessage = await require('dcp/protocol').sign(packageJSON, wallet);

  const result = await libDeployPackage.deployPackage(signedMessage)

  console.log('Response: ')
  console.log(JSON.stringify(result, null, 2))
  console.log(`Module ${packageJSON.name} deployed to ${URL}/${packageJSON.name}`)

  return { status: 'ok', result }
}

process.on('unhandledRejection', (reason, p) => {
  console.log(reason)
  process.exit(1)
})

require('dcp-client').init(entryPoint)
.then(() => {
  if (options.help) {
    return usage();
  }
  else {
    return main();
  }
})
.catch(error => {
  console.error('Unexpected failure:', error);
  process.exit(1);
})