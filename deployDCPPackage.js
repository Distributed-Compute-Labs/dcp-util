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

/* global dcpConfig */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()
global.Promise = Promise = require('promiseDebug').init(Promise)
const fs = require('fs')
const process = require('process')
const path = require('path')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// const protocol = require('protocol-node.js')
require('dcp-client/dist/protocol.min.js')
var debug = process.env.DCPDP_DEBUG || process.env.DEBUG || ''

const argvZero = require('path').basename(__filename)

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
  if (values.length === 1) {
    options[values[0]] = true
  } else {
    options[values[0]] = values[1] === 'true' ? true : values[1] === 'false' ? false : values[1]
  }
}

const usage = () => {
  console.log(`
${argvZero} - Utility to deploy a new/updated DCP package
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:  ${argvZero} OPTIONS

Where:
  --help        Display this usage screen

  --network     Deploy package to package server at ${dcpConfig.packageManager.hostname} (default)
  --local       Deploy package directly to local filesystem

  --keystore=/path/to/your.keystore
                Path to keystore file (default: ask, look for ./myDCPKey.keystore)
  --package=/path/to/package.dcp
                Path to DCP Package definition (default: ask, look for ./package.dcp)

Environment:
  DEBUG         If truthy, enable debug mode. If a string, treat as a list of extended debug flags
                (eg. DEBUG="verbose protocol" to enable DEBUG mode, with the "verbose" and "protocol" flags)
  DCP_KEYSTORE_PASSWORD
                If present, use its value as the keystore password (default: prompt for password)
`)
  
  // console.log('CLI options:', options)
  
  process.exit(1)
}

var ask = function (question, defaultAnswer, optionKey) {
  return new Promise((resolve, reject) => {
    if (typeof options[optionKey] !== 'undefined') return resolve(options[optionKey])
    if (options.silent) return resolve('')
    rl.question(question, answer => {
      if (!answer.length) answer = defaultAnswer
      resolve(answer)
    })
  })
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
  
  let packageLocation = options['--package'] || await ask('Location of package file (package.dcp):', 'package.dcp', 'package')

  let status
  try {
    status = fs.statSync(packageLocation)
  } catch (error) {
    console.log('Can not locate package description file. Please run: initDCPPackage.js')
    process.exit(2)
  }

  let packageJSON = JSON.parse(fs.readFileSync(packageLocation))
  getFiles(packageJSON)

  let keystoreLocation = options['--keystore'] || await ask('Location of keystore file (myDCPKey.keystore):', 'myDCPKey.keystore', 'keystore')

  let keystoreFile
  try {
    keystoreFile = fs.readFileSync(keystoreLocation).toString()
  } catch (error) {
    console.log('Could not open keystore file' + (error.code === 'ENOENT' ? ' - use ' + path.resolve(path.dirname(process.argv[1]) + '/createWallet.js') + ' to create' : ''))
    console.log(error)
    process.exit(2)
  }

  let password = process.env.DCP_KEYSTORE_PASSWORD || await ask('Keystore password:', '', 'keypass')
  let wallet
  try {
    wallet = protocol.unlock(keystoreFile, password)
    protocol.keychain.addWallet(wallet)
  } catch (error) {
    console.error('Could not unlock keystore; please check your password and try again')
  }

  var result = null
  try {
    let r
    
    if (options['--local']) {
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
  let baseURL = `${dcpConfig.packageManager.protocol || 'http:'}//${dcpConfig.packageManager.hostname}`
  let URL = baseURL + '/deploy/module'

  console.log(` * Deploying via network to ${URL}...`)

  let result
  try {
    console.log('Sending module to server:', baseURL)
    result = await protocol.send(URL, packageJSON, wallet.getPrivateKeyString())
  } catch (error) {
    if (error.hasOwnProperty('remote')) {
      if (error.remote.status === 'error') {
        console.error('Remote Error:', error.remote.error)
        if (debug) { console.log(error.remote) }
      } else {
        console.error('Remote Error:', error.remote)
      }
    } else {
      console.error('Cannot send module to server;', error)
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
  let baseURL = `${dcpConfig.packageManager.protocol || 'http:'}//${dcpConfig.packageManager.hostname}`
  let URL = baseURL + '/deploy/module'
  
  const database = require('database.js')
  database.init(dcpConfig.packageManager.database)

  const libDeployPackage = require('../lib/deploy-package')

  console.log(` * Deploying locally to ${database.getFilePath()}/packages/${packageJSON.name}...`)

  const signedMessage = protocol.sign(packageJSON, wallet.privateKey)

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

if (options['--help']) {
  return usage()
} else {
  return main()
}
