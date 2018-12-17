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

const protocol = require('protocol-node.js')
var debug = process.env.DCPDP_DEBUG || process.env.DEBUG || ''

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
    console.error("Cannot deploy package with no files")
    process.exit(2)
  }

  if (missingFiles) {
    process.exit(1)
  }

  packageJSON.files = deployFiles
}

var main = async () => {
  let packageLocation = await ask('Location of package file (package.dcp):', 'package.dcp', 'package')

  let status
  try {
    status = fs.statSync(packageLocation)
  } catch (error) {
    console.log('Can not locate package.dcp. Please run: node init.dcp')
    process.exit()
  }

  let packageJSON = JSON.parse(fs.readFileSync(packageLocation))
  getFiles(packageJSON)

  let keystoreLocation = await ask('Location of keystore file (myDCPKey.keystore):', 'myDCPKey.keystore', 'keystore')

  let keystoreFile
  try {
    keystoreFile = fs.readFileSync(keystoreLocation).toString()
  } catch (error) {
    console.log('Could not open keystore file' + (error.code === 'ENOENT' ? ' - use ' + path.resolve(path.dirname(process.argv[1]) + '/createWallet.js') + ' to create' : ''))
    console.log(error)
    process.exit()
  }

  let baseURL = `${dcpConfig.packageManager.protocol || 'http:'}//${dcpConfig.packageManager.hostname}:${dcpConfig.packageManager.port}`
  let URL = baseURL + '/deploy/module'

  let password = await ask('Keystore password:', '', 'keypass')
  let wallet = protocol.unlock(keystoreFile, password)
  protocol.setWallet(wallet)
  protocol.setOptions({
    useSockets: false
  })

  let result
  try {
    console.log('Sending module to server:', baseURL)
    result = await protocol.send(URL, packageJSON)
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
    process.exit(1)
  }

  // estimate credits cost to deploy
  // ask user for credits etc, note credits loaded etc

  console.log('Response: ')
  console.log(JSON.stringify(result, null, 2))
  console.log(`Module ${packageJSON.name} deployed to ${URL}/${packageJSON.name}`)
  process.exit(0)
}

process.on('unhandledRejection', (reason, p) => {
  console.log(reason)
  process.exit(1)
})

main()
