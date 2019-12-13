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

var debug = process.env.DCP_DEBUG || process.env.DEBUG || ''

// Process CLI
const options = require('yargs')
  .usage(`
$0 - Utility to deploy a new/updated DCP package
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

$0 [options]`)
  .alias('help', 'h')
  .hide('version')
  .hide('network')    // network deploy is implicit, local doesn't work now
  .boolean('network')
  .describe('network', 'Deploy the package to a remote module server')
  .describe('scheduler', 'Scheduler address of the remote DCP system')
  .hide('local')      // --local and --deployPath are currently hidden, they don't work 
                      // with the dcp-client APIs (nor should they, it's not client work)
  .boolean('local')
  .describe('local', 'Deploy package directly to your local filesystem')
  .hide('deployPath')
  .describe('deployPath', 'Local path to deploy package')
  // .conflicts('network', 'local')
  .describe('keystore', 'Name of keystore to deploy with')
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
const argvZero = require('path').basename(options['$0']);

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

  // @todo: this would be more correct using the Wallet.load() API
  const wallet = await require('dcp/wallet').get(keystoreLocation);

  var result = null
  try {
    let r

    if (options['local']) {
      r = await deployLocal(packageJSON, wallet)
    } else {
      r = await deployNetwork(packageJSON, wallet)
        .catch(error => {
          return Promise.reject({
            success: false,
            status: error.status,
            error: {
              message: error.error.message,
              code: error.error.code,
              stack: error.error.stack,
            },          
          });
        });
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
  let baseURL = /*options.packageManager || */require('dcp/dcp-config').packageManager.location;

  let URL = baseURL.resolve('/deploy/module')

  console.log(` * Deploying via network to ${baseURL.href}...`)

  const result = await require('dcp/protocol').send(URL, packageJSON, wallet);

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