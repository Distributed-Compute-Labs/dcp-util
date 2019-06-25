#! /usr/bin/env node
/**
 *  @file       job-utility.js
 *              Utility to inspect and manipulate running jobs.
 * 
 *              DCP-452: https://kingsds.atlassian.net/browse/DCP-452
 *
 *  @author     Karen Batch, karen@kingsds.network
 *  @date       April 2019
 */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load() // eslint-disable-line
require('dcp-client/dist/protocol.min.js') /* side effect: global protocol now defined :( */

const path = require('path')
const process = require('process')
const arg_util = require('./arg_util.js')
const keystore = require('./src/keystore.js')
const heap = require('heap')

/** 
 * Shows the help for this utility
 */
function usage () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Inspect and manipulate running jobs on the command line.
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:      ${progName} --action=method --job=0xJobAddress --keystore=0xPublicAddress --all=t/f


Examples:   ${progName} --action=listJobs    --keystore=0xsomePublicAddress --all
            
            ${progName} --action=countTasks  --job=0xsomeJobAddress --keystore=0xsomePublicAddress
            ${progName} --action=countTasks  --keystore=0xsomePublicAddress --all
            
            ${progName} --action=elapsedTime --job=0xsomeJobAddress --keystore=0xsomePublicAddress

            ${progName} --action=deleteJob   --job=0xsomeJobAddress --keystore=0xsomePublicAddress


Where:      --action      desired action
                          available actions:
                            - listJobs       list attributes of the jobs belonging to the given private key.
                            - countTasks     list all tasks belonging to the specified job.
                            - elapsedTime    list all slices belonging to the specified job.
                            - deleteJob      delete the specified job (terminate all tasks), will never ask
                                             for this job again, frees up remaining resources.

            --job         the address of the job to inspect
                          (omit from COUNTTASKS action to return results for all jobs)
                          (required for elapsedTime action)

            --keystore    the location of the keystore to use to send the request with

            --all         if the keystore has been whitelisted as an administrator, indicates that all jobs
                          on the heap will be returned (not valid on elapsedTime or deleteJob actions)
`)
  process.exit(1)
}

async function loadCompute(keystorePath) {
  const wallet = await keystore.getWallet(keystorePath)
  protocol.keychain.addWallet(wallet, true)
}

var argv = require('yargs').argv

/** 
 * Parses arguments, sends the request 
 */
async function start () {
  // if (!argv.action && !argv.job && !argv.keystore) {
  //   usage()
  //   return
  // }

  var paramObj = { '--action':'string', '--job':'string', '--keystore':'string', '--all':false }
  var cliArgs = arg_util(paramObj)

  if (!cliArgs['--action'] && !cliArgs['--job'] && !cliArgs['--keystore']) {
    // console.log('You must provide a configuation for action, job, and keystore')
    usage()
    return
  }

  // let action = argv.action
  let action = cliArgs['--action']
  let url = `${dcpConfig.scheduler.protocol}//${dcpConfig.scheduler.hostname}/generator/`
  // let job = argv.job || null
  let job = cliArgs['--job'] || null
  // let keystore = argv.keystore || protocol.createWallet().getPrivateKeyString()
  let keystore = cliArgs['--keystore'] || keystore.generateWallet()

  let all = cliArgs['--all']

  await loadCompute(keystore)
  sendRequest(action, url, job, keystore, all)
}

/**
 * Sends the request to the route specified. Manipulates the owner's jobs accordingly.
 * 
 * @param {string} action   Action to perform: listJobs, countTasks, elapsedTime, deleteJob
 * @param {string} url      Base URL with trailing slash; action will be appended
 * @param {string} job      Address of a job to operate on; optional for countTasks
 * @param {string} key      Private key (string) to sign requests with; must be job owner
 */
async function sendRequest (action, url, job, key, all) {
  let result
  let getListUrl = url + 'listJobs'
  let actionUrl = url + action
  try {
    // if all, check that the keystore is whitelisted
    // if everything checks out, then return all jobs on the heap
    let list

    // if (all) {
    //   list = await protocol.send(getListUrl, {job}, /*scheduler address*/)
    // }
    let list = await protocol.send(getListUrl, {job}, key)

    switch (action) {
      case 'listJobs':
        result = list
        break

      case 'countTasks':
        if (job === null) {
          // if no job specified, list all slices of all jobs
          result = []
          for (let j of list) {
            job = j.address
            res = await protocol.send(actionUrl, {job}, key)
            result.push({address: job, tasks: res})
          }
        } else {
          // job specified, return slices for only that job
          result = await protocol.send(actionUrl, {job}, key)
        }
        break

      case 'elapsedTime':
      case 'deleteJob':
        // either elapsedTime or deleteJob
        result = await protocol.send(actionUrl, {job}, key)
        break
      
      default:
        // if there was an invalid action specified, display help
        console.log('Invalid action specified, please try again.')
        usage()
        break
    }
  } catch (error) {
    result = error
  }

  console.log(result)
  protocol.disconnect()
}

start()
