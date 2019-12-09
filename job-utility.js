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

require('dcp-rtlink/rtLink').init();

const path = require('path')
const process = require('process')

// global.Promise = Promise = require('promiseDebug').init(Promise)

/** 
 * Shows the help for this utility
 */
function usage () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Inspect and manipulate running jobs on the command line.
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

USAGE:      ${progName} --action method --jobID 0xJobAddress --keystore pathToKeystoreFile {modifiers}


WHERE:      --action      desired action
                    
              AVAILABLE ACTIONS:
                
                - listJobs       list attributes of the jobs belonging to the given private key.
                                 MODIFIERS:
                                    -a           (administrative) List all jobs on the scheduler
                                    --ownedBy    (administrative) List all jobs belonging to specified owner.

                - countJobs      count all jobs based on modifier.
                                 MODIFIERS:
                                    -a           (administrative) Count all jobs on the scheduler.
                                    --ownedBy    (administrative) Count all the jobs belonging to the specified owner.
                
                - countTasks     count all tasks of each type belonging to the specified job.
                
                - elapsedTime    display amount of time each slice belonging to the specified 
                                 job has been running.
                
                - deleteJob      delete the specified job (terminate all tasks), will never ask
                                 for this job again, frees up remaining resources.
                                 MODIFIERS:
                                    -a        (administrative) Specifies all jobs are target of deletion
                                              **** MUST BE COMBINED WITH --ownedByFLAG
                                    --ownedBy (administrative) Will delete all the jobs on the scheduler with specified owner.
                                              **** MUST BE COMBINED WITH -a FLAG

            --jobID       the address of the job to inspect
                          (omit from COUNTTASKS action to return results for all jobs)
                          (required for elapsedTime action)

            --keystore    the location of the keystore to use to send the request with


EXAMPLES:   ${progName} --action listJobs --keystore pathToKeystoreFile
            ${progName} --action listJobs --keystore pathToAdminKeystoreFile -a
            ${progName} --action listJobs --keystore pathToAdminKeystoreFile --ownedBy 0xPrivateKey

            ${progName} --action countJobs --keystore pathToKeystoreFile
            ${progName} --action countJobs --keystore pathToAdminKeystoreFile -a
            ${progName} --action countJobs --keystore pathToAdminKeystoreFile --ownedBy 0xPrivateKey
            
            ${progName} --action countTasks --jobID 0xsomeJobAddress --keystore pathToKeystoreFile
            
            ${progName} --action elapsedTime --jobID 0xsomeJobAddress --keystore pathToKeystoreFile

            ${progName} --action deleteJob --jobID 0xsomeJobAddress --keystore pathToKeystoreFile
            ${progName} --action deleteJob --keystore pathToKeystoreFile -a
                ** this will delete ALL jobs belonging to you
            ${progName} --action deleteJob --keystore pathToAdminKeystoreFile -a --ownedBy 0xPrivateKey
                ** this last example will delete ALL jobs belonging to the specified owner
`)
  process.exit(1)
}

/** 
 * Parses arguments, sends the request 
 */
async function start () {
  var cliArgs = require('yargs').argv;
  
  if (!cliArgs['action']) {
    console.error('\nOOPS! You must provide a configuation for action. See below.\n')
    usage()
    return
  }
  
  await require('dcp-client').init(cliArgs['scheduler']);
  
  let url           = require('dcp/dcp-config').scheduler.location.resolve('/generator/')
  let action        = cliArgs['action']
  let jobID         = String(cliArgs['jobID']).toLowerCase() || null
  let keystoreFile  = cliArgs['keystore']
  let all           = cliArgs['a']
  let ownerPK       = cliArgs['ownedBy'] || false

  const myKeystore  = await require('dcp/wallet').get(keystoreFile);
  const privateKey  = await myKeystore.getPrivateKey();
  
  return sendRequest(action, url, jobID, myKeystore, all, ownerPK)
}

/**
 * Sends the request to the route specified. Manipulates the owner's jobs accordingly.
 * 
 * @param {string} action           Action to perform: listJobs, countTasks, elapsedTime, deleteJob
 * @param {string} url              Base URL with trailing slash; action will be appended
 * @param {string} job              Address of a job to operate on; optional for countTasks
 * @param {string} key              Private key (string) to sign requests with; must be job owner or whitelisted address
 * @param {boolean} all             Flag for getting all jobs on heap back
 * @param {string} ownerPrivateKey  Passed by admin user to manipulate jobs belonging to that private key
 */
async function sendRequest (action, url, jobID, privateKey, all = false, ownerPrivateKey = false) {
  const protocol = require('dcp/protocol');

  let result
  //let getListUrl = url + 'listJobs'
  let actionUrl = url + action
  
  try {
    
    //let list = await protocol.send(getListUrl, {job, all}, key)

    switch (action) {
      
      case 'listJobs':
      case 'countJobs':
        if (ownerPrivateKey) {
          // if ownedBy modifier has been given a private key, make the request
          // using that private key to return all the jobs belonging to that
          // address
          result = await protocol.send(actionUrl, {jobID, all}, ownerPrivateKey)
        } else {
          // if the 'all' flag is true, then the user is an admin and will return
          // all jobs on the heap. If they are not a user, then this will only
          // return the jobs belonging to them.
          result = await protocol.send(actionUrl, {jobID, all}, privateKey)
        }
        break

      case 'countTasks':
        if (jobID === null) {
          // if no job specified, list all slices of all jobs
          result = []
          for (let j of list) {
            jobID = j.address
            res = await protocol.send(actionUrl, {jobID}, privateKey)
            result.push({address: jobID, tasks: res})
          }
        } else {
          // job specified, return slices for only that job
          result = await protocol.send(actionUrl, {jobID}, privateKey)
        }
        break

      case 'elapsedTime':
        result = await protocol.send(actionUrl, {jobID}, privateKey)
        break

      case 'deleteJob':
        if (ownerPrivateKey && all) {
          let list = await protocol.send(url + 'listJobs', {jobID, all}, ownerPrivateKey)
          result = []
          for (let job of list) {
            jobID = job.address
            res = await protocol.send(actionUrl, {jobID}, ownerPrivateKey)
            result.push({address: jobID, result: res})
          }
        } else if ((!ownerPrivateKey) && all) {
          let list = await protocol.send(url + 'listJobs', {jobID, all}, privateKey)
          result = []
          for (let job of list) {
            jobID = job.address
            res = await protocol.send(actionUrl, {jobID}, privateKey)
            result.push({address: jobID, result: res})
          }
        } else {
          console.log('actionUrl:', actionUrl, '\njobID:', jobID, '\nprivateKey:', privateKey)
          result = await protocol.send(actionUrl, {jobID}, privateKey)
        }
        break
      
      default:
        // if there was an invalid action specified, display help
        console.log('Invalid action specified, please try again.')
        console.log('For help, use command `node job-utility.js` with no arguments.')
        break
    }
  } catch (error) {
    result = error
  }

  protocol.disconnect()
  
  return result;
}

start()
  .then(result => {
    console.log(result.message || result);
    process.exit(0);
  })
  .catch(error => {
    console.log('Something broke!');
    console.error(error);

    process.exit(1);
  })
