#! /usr/bin/env node
/**
 *  @file               deploy-test-generator.js
 *                      Utility to deploy one of our generators (emcoil, asteroids, diskfit).
 *
 *  @author             Matthew Palma, mpalma@kingsds.network
 *  @date               Jan 2019
 */

/* globals dcpConfig, Generator, protocol */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load() // eslint-disable-line

// polyfill
// global.window = global
// global.window.location = { protocol: (dcpConfig.build.indexOf('release') >= 0) ? 'https:' : 'http:' }
global.XMLHttpRequest = require('dcp-xhr').XMLHttpRequest
global.performance = require('perf_hooks').performance
// global.navigator = { hardwareConcurrency: 1 }
global.URL = require('url').URL

require('dcp-client/dist/compute.min.js')
const path = require('path')
let argv = require('yargs').argv
const fs = require('fs')

function usage () {
  let progName = path.basename(process.argv[1])

  console.log(`
${progName} - Utility to deploy one of our generators
Copyright (c) 2018 Kings Distributed Systems Ltd., All Rights Reserved.

To change the following, change your dcp-site-config.js.
Scheduler: ${dcpConfig.scheduler.protocol}//${dcpConfig.scheduler.hostname}
Bank: ${dcpConfig.bank.protocol}//${dcpConfig.bank.hostname}

Usage:     ${progName} --app=genName --key=0xPrivateKey

Where:
  --app    the name of the generator to deploy
           available generators: ${Object.keys(generatorMap)}
  --key    the private key to use to submit the generator
           (must have DCC's at: ${dcpConfig.bank.protocol}//${dcpConfig.bank.hostname})

Options:
  --wait   'true' to wait for the generator to complete before exiting
           (default:false)

Example:   ${progName} --app=emcoil --key=0xsomePrivateKeyWithDCCAtCurrentBank
           
           You can also use config overrides to change destinations:

             DCP_CONFIG_SCHEDULER='{"hostname":"scheduler.devserver"}'
             DCP_CONFIG_BANK='{"hostname":"bank.devserver"}'
             DCP_CONFIG_PACKAGE_MANAGER='{"hostname": "modules.devserver"}'
             ${progName} --app=emcoil --key=0xsomePrivateKeyWithDCCAtCurrentBank
`)
  process.exit(1)
}

// @todo: Scan the generator-data directory and add generators dynamically
const generatorMap = {
  'emcoil': './generator-data/emcoil.json',
  'emcoil-big': './generator-data/emcoil-big.json',
  'asteroids': './generator-data/asteroids.json'
  // 'diskfit': './generator-data/diskfit.json'
}

/**
 * Fetches a generator by its name.
 * Throws if no generator by that name exists.
 *
 * @param {string} name - name of the generator to fetch
 * @returns {Generator} - the newly minted generator
 */
function getGenerator (name) {
  if (!generatorMap[name]) {
    throw new Error(`No generator named '${name}' exists. Supported generators: ${Object.keys(generatorMap)}.`)
  }
  let generator = JSON.parse(fs.readFileSync(path.join(__dirname, generatorMap[name])))
  return new Generator(generator)
}

/** Parses arguments, sets up your wallet and deploys the generator */
async function start () {
  if (!argv.key || !argv.app) {
    usage()
    return
  }

  if (!argv.wait || argv.wait === 'false') {
    argv.wait = false
  } else {
    argv.wait = true
  }

  protocol.keychain.addPrivateKey(argv.key, true)
  deployGenerator(getGenerator(argv.app))
}

/**
 * Accepts a generator and deploys it the scheduler.
 * Exits when the generator completes if --wait=true,
 * otherwise it exits when the generator is accepted.
 *
 * @param {Generator} generator - the generator to deploy
 */
async function deployGenerator (generator) {
  let resultP
  try {
    generator.on('accepted', ev => {
      ev.generator.worker = 'worker...'
      console.log(`Generator '${generator._generator.address}' Deployed`)
      if (!argv.wait) {
        process.exit(1)
      }
    })
    // generator.setPaymentWallet(protocol.keychain.keys[protocol.keychain.currentAddress].wallet)
    resultP = generator.exec(undefined, protocol.keychain.keys[protocol.keychain.currentAddress].wallet)
  } catch (error) {
    resultP = error
  }
  
  const result = await resultP
  console.log(result)
  return result
}

start()
