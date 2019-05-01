#! /usr/bin/env node
/**
 *  @file               generator-utility.js
 *                      Utility to inspect and manipulate running generators.
 *
 *  @author             Karen Batch, karen@kingsds.network
 *  @date               April 2019
 */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load() // eslint-disable-line
const path = require('path')
const process = require('process')
const protocol = require('protocol-node')

function usage () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Inspect and manipulate running generators on the command line.
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} --action=method --generator=0xGenAddress --key=0xPrivateKey

Example: ${progName} --action=list  --key=0xsomePrivateKey
         ${progName} --action=tasks --generator=0xsomeGeneratorAddress --key=0xsomePrivateKey
         ${progName} --action=tasks --key=0xsomePrivateKey

Where:
  --action      desired action
                available actions:
                  - list    list attributes of the specified generator
                  - tasks   list all tasks belonging to the specified generator

  --generator   the address of the generator to inspect
                (omit to return results for all generators)

  --key         the private key to use to send the request with
`)
  process.exit(1)
}

var argv = require('yargs').argv

async function start () {
  //console.log(dcpConfig.scheduler)
  if (!argv.action && !argv.generator && !argv.key) {
    usage()
    return
  }
  let action = argv.action
  // let url = `${dcpConfig.scheduler.protocol}//scheduler.karen.office.kingsds.network/generator/${argv.action}`
  let url = `${dcpConfig.scheduler.protocol}//scheduler.karen.office.kingsds.network/generator/`
  let generator = argv.generator || null
  let key = argv.key || protocol.createWallet().getPrivateKeyString()
  sendRequest(action, url, generator, key)
}

async function sendRequest (action, url, generator, key) {
  let result
  let getListUrl = url + 'list'
  try {
    let list = await protocol.send(getListUrl, {generator}, key)
    if (action == 'list') {
      result = list
    } else {
      actionUrl = url + action
      if (generator === null) {
        result = []
        // iterate through each object in list
        for (let gen of list) {
          generator = gen.address
          res = await protocol.send(actionUrl, {generator}, key)
          result.push({address: generator, tasks: res}) 
        }
      } else {
        result = await protocol.send(actionUrl, {generator}, key)
      }
      
    }
  } catch (error) {
    result = error
  }

  console.log(result)
  protocol.disconnect()
}

start()
