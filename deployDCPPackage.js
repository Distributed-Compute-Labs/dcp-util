/**
 *  @file       deploy.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Utility for compiling and deploying DCP Modules from npm repositories
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

const protocol = require('../src/node/protocol-node.js')

var packageJSON

var deploy = () => {
  rl.question('Location of keystore file (myDCPKey.keystore): ', keystoreLocation => {
    if (keystoreLocation.length === 0) keystoreLocation = 'myDCPKey.keystore'
    fs.readFile(keystoreLocation, (error, data) => {
      let keystoreFile = data.toString()
      if (error) {
        console.log('Could not open keystore file')
        console.log(error)
        process.exit()
      } else {
        rl.question('Keystore password: ', password => {
          let wallet = protocol.unlock(keystoreFile, password)
          protocol.setWallet(wallet)

          // estimate credits cost to deploy
          // ask user for credits etc, note credits loaded etc

          console.log('Sending module to server: ' + 'http://modules.goblin.test')
          protocol.send('http://modules.goblin.test/deploy/module', packageJSON).then(signedResult => {
            console.log('Response: ')
            console.log(JSON.stringify(JSON.parse(signedResult), null, 2))
            console.log('Module ' + packageJSON.name + ' deployed to ' + 'http://modules.goblin.test/fetch/module/' + packageJSON.name)
            process.exit()
          }).catch(error => {
            let message = JSON.parse(error.data)
            console.log(JSON.stringify(message.module, null, 2))
            console.log(message.error)
            process.exit()
          })
        })
      }
    })
  })
}

var getFiles = () => {
  let filenames = Object.keys(packageJSON.files)
  let deployPaths = Object.values(packageJSON.files)
  let missingFiles = false
  for (let i = 0; i < filenames.length; i++) {
    try {
      packageJSON.files[deployPaths[i]] = fs.readFileSync(filenames[i]).toString()
      delete packageJSON.files[filenames[i]]
    } catch (error) {
      console.log('Missing File: ' + filenames[i])
      missingFiles = true
    }
  }

  if (missingFiles) {
    process.exit()
  }

  deploy()
}

rl.question('Location of package file (package.dcp): ', packageLocation => {
  if (packageLocation.length === 0) packageLocation = 'package.dcp'
  fs.stat(packageLocation, (error, status) => {
    if (error) {
      console.log('Can not locate package.dcp. Please run: node init.dcp')
      process.exit()
    } else {
      packageJSON = JSON.parse(fs.readFileSync('package.dcp'))
      getFiles()
    }
  })
})
