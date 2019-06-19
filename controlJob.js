#! /usr/bin/env node
/** @file       dcpjob          Command-line utility to communicate with the scheduler
 *  @author     Wes Garland, wes@sparc.network
 *  @date       Feb 2018
 */

/* global */

require('dcp-rtlink/rtLink.js').link(module.paths)
console.log(require('process').env.NODE_PATH)
require('config').load()

// polyfill
global.window = global
global.window.location = { protocol: (dcpConfig.build.indexOf('release') >= 0) ? 'https:' : 'http:' }
global.crypto = { getRandomValues: require('crypto').randomBytes }
global.ethereumjs = require('ethereumjs-tx/ethereumjs-tx-1.3.3.min.js')
global.ethereumjs.Wallet = require('ethereumjs-wallet')
global.XMLHttpRequest = require('dcp-xhr').XMLHttpRequest
global.performance = require('perf_hooks').performance
global.navigator = { hardwareConcurrency: 1 }
global.io = require('socket.io-client')

global.Worker = require('standaloneWorker').Worker
// require('standaloneWorker').config.debug = true
// require('standaloneWorker').config.debugLevel = 4

// const protocol = require('../node/lib/protocol-node.js')
const Compute = require('compute').default
const fs = require('fs')
const path = require('path')
const protocol = new (require('protocol').default)()

function usage () {
  let progName = path.basename(process.argv[1])
  console.log(`
${progName} - Control jobs on the DCP Network
Copyright (c) 2018 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} compile <job.json > [options] |
         ${progName} sign <job.dcp | generator.json> [options] |
         ${progName} deploy <job.tx | generator.tx> [options] |
         ${progName} cancel <jobid> |
         ${progName} view [options] |
         ${progName} fetch [options] |
         ${progName} results <jobid> [options]
Where:
        job.json       is a file containing a basic JSON definition of a job.
        job.dcp        is a file containing a compiled JSON definition of a job.
        job.tx         is a file containing a compiled and signed JSON
                       definition of a job.
        generator.json is a file containing a basic JSON definition of a generator.
        generator.tx   is a file containing a signed generator.
        worker.js      is a file containing ES6 code which is executed as
                       the jobs function.
        jobid          is the address of an existing job.

Global Options:
 --help          view this help
 --jobBoard=     specify the the job board base URL
                 (default: ${global.window.location.protocol}//${dcpConfig.board.hostname}:${dcpConfig.board.port})
 --key=          specify the private key to use when communicating with
                 the job board. (default: ~/.dcp/keys/id)

Deploy Options:
 --type=         'job' if deploying a job
                 'generator' if deploying a generator
                 (default: job)

Results Options:
 --type=         'job' if you want all results from a job
                 'generator' if all results from a generator
                 'task' if you just want a single tasks results
                 (default: job)
 --address=      the address of the type you are requesting
                 if you use type=job, then this is not required
 --location=     the directory where you want to save results
                 (default: results)
`)

  process.exit(0)
};

function sendParent (type, message) {
  if (!process.send) {
    return
  }
  process.send({
    type: type,
    message: message
  })
}

function fnExpand (a) {
  return a.replace(/^~\//, require('os').homedir + '/')
}

/** Merge properties from a JSON file into an option
 *  @param      inobj           object to modify
 *  @param      jsonFile        a file containing a JSON object
 *  @param      overwrite       Overwrite identical properties; default = true
 *  @returns    inobj
 */
function mergeJSONFile (inobj, jsonFile, overwrite) {
  var json = fs.readFileSync(fnExpand(jsonFile), 'utf8')
  var object, element

  if (typeof overwrite === 'undefined') { overwrite = true }

  object = JSON.parse(json)
  for (element in object) {
    if (object.hasOwnProperty(element)) {
      if (overwrite || inobj.hasOwnProperty(element)) { inobj[element] = object[element] }
    }
  }

  return inobj
}

function parseResponse (response) {
  try {
    if (response instanceof Buffer) {
      response = response.toString()
    } else if (typeof response === 'string') {
      response = JSON.parse(response)
    }
  } catch (e) {
    console.warn('Problem while converting response to JSON', e)
  }
  return response
}

/** Compile and validate a job for the DCP Network */
function compileJob (args, options) {
  let parsedPath = path.parse(args[0])

  let job = JSON.parse(fs.readFileSync(parsedPath.dir + '/' + parsedPath.base, 'utf8'))

  parseOptions(args.slice(1), [ 'resultURL' ], options)

  if (job.worker.slice(job.worker.length - 3) === '.js') {
    job.worker = fs.readFileSync(parsedPath.dir + '/' + job.worker, 'utf8')
  }

  if (job['//']) delete job['//']

  fs.writeFileSync(parsedPath.dir + '/' + parsedPath.name + '.dcp', JSON.stringify(job, null, 2), 'utf8')
}

/** Compile, Validate and Sign a job for the DCP Network */
async function sign (args, options, privateKey) {
  let parsedPath = path.parse(args[0])
  let object

  parseOptions(args.slice(1), [ 'jobBoard', 'type' ], options)
  switch (parsedPath.ext) {
    case '.json':
      if (options.type === 'job') { compileJob(args, options) }
      // fallthrough
    case '.dcp':
      let ext = '.dcp'
      if (options.type === 'generator') { ext = '.json' }
      object = JSON.parse(fs.readFileSync(parsedPath.dir + '/' + parsedPath.name + ext))
      break
    default:
      console.error('Unrecognized fileExtension:', parsedPath.ext, args[0])
      process.exit(1)
  }
  // this block could probably go somewhere else
  // infact this entire file needs to be refactored
  try {
    let compute = new Compute()
    if (options.type === 'job') {
      let tests = await compute.testJob(object)
      object.tests = tests
    } else if (options.type === 'generator') {
      let job = fs.readFileSync(parsedPath.dir + '/job-' + object.job + '.json', 'utf8')
      job = JSON.parse(job)
      await compute.testGenerator(job, object, 1)
    }
  } catch (e) {
    console.error(`Failed to test ${options.type}`)
    console.error(e)
    process.exit(1)
  }
  let transaction = protocol.sign(object, privateKey)
  fs.writeFileSync(parsedPath.dir + '/' + parsedPath.name + '.tx', JSON.stringify(transaction, null, 2), 'utf8')
}

/** Compile, Validate, Sign and Deploy a job for the DCP Network */
async function deploy (args, options, privateKey) {
  parseOptions(args.slice(), ['type', 'echo'], options)
  let parsedPath = path.parse(args[0])
  let transaction

  switch (parsedPath.ext) {
    case '.json':
      if (options.type === 'job') { compileJob(args, options) }
      // fallthrough
    case '.dcp':
      await sign(args, options, privateKey)
      // fallthrough
    case '.tx':
      transaction = JSON.parse(fs.readFileSync(parsedPath.dir + '/' + parsedPath.name + '.tx'))
      break
    default:
      console.error('Unrecognized fileExtension:', parsedPath.ext, args[0])
      process.exit(1)
  }

  let url = options.jobBoard + '/deploy/' + options.type
  protocol.send(url, transaction, privateKey, true)
    .then(response => {
      response = parseResponse(response)
      let echo = response.data.message
      if (options.echo) {
        console.log(`Compiled ${options.type}:`)
        console.log(echo)
      }
      sendParent(options.type, response.data)
      fs.writeFileSync(`${parsedPath.dir + '/'}${options.type}-${echo.address}.json`, JSON.stringify(echo, null, 2), 'utf8')
    })
    .catch(error => {
      console.error('Failed to deploy', options.type)
      console.error(error)
      process.exit(1)
    })
}

/** Fetch results for a job and save them in the results/<jobid> directory */
async function getResults (args, options, privateKey) {
  let jobid = args.shift()
  parseOptions(args.slice(), ['address', 'location'], options)
  if (!options.location) {
    options.location = 'results'
  }
  if (jobid) {
    let request = {
      job: jobid
    }
    request[options.type] = options.address
    let response
    try {
      response = await protocol.send(options.jobBoard + `/results/${options.type}`, request, privateKey)
      response = parseResponse(response)
      response = response.data
      // console.log(response)
    } catch (e) {
      console.error('Error getting results', e)
      return
    }
    let location = `${options.location}/${options.type}/${options.address}/`
    if (!fs.existsSync(location)) {
      try {
        if (!fs.existsSync(`${options.location}/`)) { fs.mkdirSync(`${options.location}/`) }
        if (!fs.existsSync(`${options.location}/${options.type}`)) { fs.mkdirSync(`${options.location}/${options.type}`) }
        fs.mkdirSync(location)
      } catch (e) {
        console.error(e)
        return
      }
    }
    let results = response.results
    for (let i = 0; i < results.length; i++) {
      // console.log(results[i])
      fs.writeFileSync(location + results[i].message.address + '.json', JSON.stringify(results[i].message), 'utf8')
    }
    sendParent('results', true)
    console.log('Recieved and saved ' + results.length + ' results for job', jobid, '!')
  } else {
    console.log('To get results for a job you must present a jobid.')
  }
}

/* Attemps to cancel a job given a jobid */
function cancelJob (args, options, privateKey) {

}

/* Looks up all jobs submited by the provided private key and prints their id's */
function viewJobs (args, options, privateKey) {

}

function fetch (args, options, privateKey) {
  parseOptions(args.slice(0), ['address', 'echo'], options)
  return protocol.send(options.jobBoard + `/fetch/${options.type}`, { address: options.address }, privateKey)
    .then(response => {
      response = parseResponse(response)
      if (options.echo) {
        console.log('Job:')
        console.log(response.data)
      }
      sendParent(options.type, response.data)
    })
    .catch(error => {
      console.error(`Could not fetch ${options.type} with address ${options.address}`)
      console.error(error)
      process.exit(1)
    })
}

/** Parse an argument vector, removing arguments which have been parsed, returning an options
 *  object. Arguments are key value parts. Arguments without a value are treated as true.
 *
 *  @param      arguments       The argument
 *  @param      array           An array of strings containing the list of arguments to parse
 *  @param      options         An options object to populate - if undefined, use {}
 *  @param      forceAll        If truey and not all arguments parsed, display an error and exit.
 *
 *  @returns    an options object
 */
function parseOptions (args, array, options, forceAll) {
  if (!options) options = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i][0] !== '-' || args[i][1] !== '-') continue
    let equalPosition = args[i].indexOf('=')
    if (equalPosition === -1) {
      options[args[i].slice(2)] = true
      continue
    }
    let key = args[i].slice(2, equalPosition)
    let value = args[i].slice(equalPosition + 1)
    if (array.indexOf(key) === -1) {
      if (forceAll) {
        console.error('Unrecognized option:', key, value)
        process.exit(1)
      }

      continue
    }
    options[key] = value
  }

  return options
}

/** Main program entry point */
async function main (argv) {
  var mode = argv[1]
  var options, privateKey

  argv = argv.slice(1)
  options = parseOptions(argv, [ 'help', 'jobBoard', 'key', 'type', 'debug', 'privateKey' ])
  if (!mode || options.help) { usage() }

  require('standaloneWorker').config.debug = options.debug

  if (!options.jobBoard) {
    options.jobBoard = `${global.window.location.protocol}//${dcpConfig.board.hostname}:${dcpConfig.board.port})`
  }
  if (!options.type) { options.type = 'job' }

  // if(dev){
  privateKey = '0xe6d2872484002fe72f0d2424ce293c4687a69f74741aa003dd51b71af6aa4321'
  if (options.privateKey) {
    privateKey = options.privateKey
  }
  // }else{
  //  privateKey = fs.readFileSync(fnExpand(options.key || "~/.dcp/keys/id"), "utf8").replace(/[^0-9a-fx]/g, "");
  // }

  switch (mode) {
    case 'cancel':
      cancelJob(argv.slice(1), options, privateKey)
      break
    case 'compile':
      compileJob(argv.slice(1), options)
      break
    case 'sign': // should compile
      sign(argv.slice(1), options, privateKey)
      break
    case 'deploy': // should sign + compile
      deploy(argv.slice(1), options, privateKey)
      break
    case 'results':
      getResults(argv.slice(1), options, privateKey)
      break
    case 'view':
      viewJobs(argv.slice(1), options, privateKey)
      break
    case 'fetch':
      fetch(argv.slice(1), options, privateKey)
      break
    default:
      console.error('Invalid mode: ' + mode)
      process.exit(1)
  }
}

main([].concat(process.argv).slice(1))
