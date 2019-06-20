/**
 *  @file       deploy.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Utility for compiling and deploying DCP Modules from npm repositories
 *
 *              CLI Usage: deployDCPPacakge.js package=app.dcp keystore=myDCPKey.keystore keypass=mypass
 *
 *  @author     Greg Agnew, gagnew@sparc.network
 *  @date       May 2018
 */

/* global dcpConfig */

require('dcp-rtlink/rtLink').link(module.paths)
require('../src/node/config.js').load()
// global.Promise = Promise = require('promiseDebug').init(Promise)
const fs = require('fs')
const process = require('process')
const path = require('path')
const readline = require('readline')
const base64Img = require('base64-img')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const protocol = require('../src/node/protocol-node.js')
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

var main = async () => {
  let appLocation = process.cwd() + '/' + await ask('Location of package file (app.dcp):', 'app.dcp', 'app')

  let status
  try {
    status = fs.statSync(appLocation)
  } catch (error) {
    console.log('Can not locate app.dcp. Please run: node init.dcp')
    process.exit()
  }

  let appJSON = JSON.parse(fs.readFileSync(appLocation))

  try {
    appJSON.index = fs.readFileSync(process.cwd() + '/' + appJSON.index).toString()
  } catch (error) {
    console.error('Cannot locate index file')
    process.exit(2)
  }

  try {
    appJSON.icon = base64Img.base64Sync(process.cwd() + '/' + appJSON.icon)
  } catch (error) {
    console.error('Cannot locate index file')
    process.exit(2)
  }

  let keystoreLocation = await ask('Location of keystore file (myDCPKey.keystore):', 'myDCPKey.keystore', 'keystore')

  let keystoreFile
  try {
    keystoreFile = fs.readFileSync(process.cwd() + '/' + keystoreLocation).toString()
  } catch (error) {
    console.log('Could not open keystore file' + (error.code === 'ENOENT' ? ' - use ' + path.resolve(path.dirname(process.argv[1]) + '/createWallet.js') + ' to create' : ''))
    console.log(error)
    process.exit()
  }

  let baseURL = dcpConfig.packageManager.location
  let URL = baseURL.resolve('/deploy/app')

  let password = await ask('Keystore password:', '', 'keypass')
  let wallet = protocol.unlock(keystoreFile, password)
  protocol.setWallet(wallet)
  // protocol.setOptions({
  //   useSockets: true
  // })

  let result
  try {
    console.log('Sending module to server:', baseURL, URL)
    result = await protocol.send(URL, appJSON)
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
  console.log(`Application ${appJSON.name} deployed to ${URL}/${appJSON.name}`)
  process.exit(0)
}

process.on('unhandledRejection', (reason, p) => {
  console.log(reason)
  process.exit(1)
})

main()
