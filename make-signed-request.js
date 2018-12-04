#! /usr/bin/env node
/**
 *  @file               make-signed-request.js
 *                      Utility to make signed requests to the servers.
 *
 *  @author             Matthew Palma, mpalma@kingsds.network
 *  @date               Dec 2018
 */

require('dcp-rtlink/rtLink').link(module.paths)
const dcpConfig = require('config').load() // eslint-disable-line
const path = require('path')
const process = require('process')
const protocol = require('protocol-node')

function usage () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Query values from dcpConfig
Copyright (c) 2018 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} --host=hostname/method --body='{}' --key=0xPrivateKey
Example: ${progName} --host=http://scheduler.devserver.office.kingsds.network/fetch/task --body='{"minValue": 100}'
`)
  process.exit(1)
}

var argv = require('yargs').argv

async function start () {
  if (!argv.host && !argv.body && !argv.key) {
    usage()
    return
  }
  let host = argv.host
  let body = JSON.parse(argv.body || '{}')
  let key = argv.key || protocol.createWallet().getPrivateKeyString()
  sendRequest(host, body, key)
}

async function sendRequest (host, body, key) {
  let result
  try {
    result = await protocol.send(host, body, key)
  } catch (error) {
    result = error
  }
  console.log(result)
}

start()
