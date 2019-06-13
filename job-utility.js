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
const path = require('path')
const process = require('process')
const protocol = require('protocol-node')

/** 
 * Shows the help for this utility
 */
function usage () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Inspect and manipulate running jobs on the command line.
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:      ${progName} --action=method --job=0xJobAddress --key=0xPrivateKey


Examples:   ${progName} --action=listJobs    --key=0xsomePrivateKey
            
            ${progName} --action=countTasks  --job=0xsomeJobAddress --key=0xsomePrivateKey
            ${progName} --action=countTasks  --key=0xsomePrivateKey
            
            ${progName} --action=elapsedTime --job=0xsomeJobAddress --key=0xsomePrivateKey

            ${progName} --action=deleteJob   --job=0xsomeJobAddress --key=0xsomePrivateKey


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

            --key         the private key to use to send the request with
`)
  process.exit(1)
}

var argv = require('yargs').argv

/** 
 * Parses arguments, sends the request 
 */
async function start () {
  if (!argv.action && !argv.job && !argv.key) {
    usage()
    return
  }
  let action = argv.action
  let url = `${dcpConfig.scheduler.protocol}//${dcpConfig.scheduler.hostname}/generator/`
  let job = argv.job || null
  let key = argv.key || protocol.createWallet().getPrivateKeyString()
  sendRequest(action, url, job, key)
}

/**
 * Sends the request to the route specified. Manipulates the owner's jobs accordingly.
 * 
 * @param {string} action   Action to perform: listJobs, countTasks, elapsedTime, deleteJob
 * @param {string} url      Base URL with trailing slash; action will be appended
 * @param {string} job      Address of a job to operate on; optional for countTasks
 * @param {string} key      Private key (string) to sign requests with; must be job owner
 */
async function sendRequest (action, url, job, key) {
  let result
  let getListUrl = url + 'listJobs'
  let actionUrl = url + action
  try {
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
