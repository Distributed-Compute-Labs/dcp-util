#! /usr/bin/env node
/**
 *  @file       createWallet.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Utility for creating a ethereum-enabled keystore files
 *
 *  @author     Greg Agnew, gagnew@sparc.network
 *  @date       May 2018
 *
 *  @deprecated - use mkad.js for new work /wg oct 2019
 */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()
const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

global.crypto = { getRandomValues: require('polyfill-crypto.getrandomvalues') }
require('dcp-client/dist/compute.min')

rl.question('Privatekey (leave blank to generate a new privatekey): ', privatekey => {
  rl.question('Keystore password: ', password => {
    let wallet
    try {
      wallet = protocol.createWallet(privatekey.length ? privatekey : false, password)
    } catch (error) {
      console.log('Failed to create wallet from privatekey')
      console.log(error)
      process.exit()
    }

    let keystore = protocol.createKeystore(wallet, password)

    rl.question('Write keystore to path (myDCPKey.keystore): ', filepath => {
      if (filepath.length === 0) filepath = 'myDCPKey.keystore'
      fs.stat(filepath, (error, status) => {
        if (error) {
          fs.writeFileSync(filepath, JSON.stringify(keystore, null, 2))
          console.log('Keystore for address ' + keystore.address + ' created and stored at ' + filepath)
          process.exit()
        } else {
          console.log('Filepath already exsits')
          process.exit()
        }
      })
    })
  })
})
