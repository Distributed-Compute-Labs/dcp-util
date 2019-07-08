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
const arg_util = require('arg_util.js')
const keystore = require('keystore.js')
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
                            - countTasks     count all tasks of each type belonging to the specified job.
                            - elapsedTime    display amount of time each slice belonging to the specified 
                                             job has been running.
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
  
  var paramObj = { '--action':'string', '--job':'string', '--keystore':'string', '--all':false }
  var cliArgs = arg_util(paramObj)
  
  if (!cliArgs['--action'] && /*!cliArgs['--job'] &&*/ !cliArgs['--keystore']) {
    console.log('You must provide a configuation for action, and keystore')
    usage()
    return
  }

  let url           = dcpConfig.scheduler.location.resolve('/generator/')
  let action        = cliArgs['--action']
  let job           = cliArgs['--job'] || null
  let keystore      = cliArgs['--keystore']
  let all           = cliArgs['--all']

  await loadCompute(keystore)
  let privateKey = protocol.keychain.keys[Object.keys(protocol.keychain.keys)[0]].privateKey

  // DEBUGGING STUFF
  // console.log('job-utility.js line 104; before calling sendRequest')
  // console.log('\naction:', action, '\nurl:', url, '\njob:', job, '\nall:', all, '\n')
  // END DEBUGGING STUFF
  
  if (!dcpConfig.scheduler.whitelistManagerAddresses.includes(protocol.keychain.currentAddress)) {
    console.log('\nATTENTION: You do not have administrative permissions. "--all" will have no effect\n')
    all = false
  }

  // DEBUGGING STUFF
  // console.log('job-utility.js line 104; before calling sendRequest')
  // END DEBUGGING STUFF

  sendRequest(action, url, job, privateKey, all)
}

/**
 * Sends the request to the route specified. Manipulates the owner's jobs accordingly.
 * 
 * @param {string} action   Action to perform: listJobs, countTasks, elapsedTime, deleteJob
 * @param {string} url      Base URL with trailing slash; action will be appended
 * @param {string} job      Address of a job to operate on; optional for countTasks
 * @param {string} key      Private key (string) to sign requests with; must be job owner or whitelisted address
 * @param {boolean} all     Flag for getting all jobs on heap back
 */
async function sendRequest (action, url, job, key, all = false) {

  let result
  let getListUrl = url + 'listJobs'
  let actionUrl = url + action

  // DEBUGGING STUFF
  // console.log('job-utility.js line 127; before try-catch statement')
  // END DEBUGGING STUFF

  try {
    
    let list = await protocol.send(getListUrl, {job, all}, key)

    // DEBUGGING STUFF
    // console.log('job-utility.js line 137; before switch statement')
    // END DEBUGGING STUFF

    switch (action) {
      case 'listJobs':
        // DEBUGGING STUFF
        // console.log('job-utility.js line 143; "listJobs" switch case')
        // END DEBUGGING STUFF

        result = list
        break

      case 'countTasks':
        // DEBUGGING STUFF
        // console.log('job-utility.js line 151; "countTasks" switch case')
        // END DEBUGGING STUFF

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
        // DEBUGGING STUFF
        // console.log('job-utility.js line 171; "elapsedTime/deleteJob" switch case')
        // END DEBUGGING STUFF

        // either elapsedTime or deleteJob
        result = await protocol.send(actionUrl, {job}, key)
        break
      
      default:
        // DEBUGGING STUFF
        // console.log('job-utility.js line 180; "default" switch case')
        // END DEBUGGING STUFF

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
