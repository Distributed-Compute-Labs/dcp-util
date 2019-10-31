#! /usr/bin/env node
/**
 * @file dcp-siege.js
 * 
 * dcp-siege provides the ability to rapidly fire off signed (and unsigned)
 * requests to some url (like the scheduler).
 * 
 * @author Matthew Palma, mpalma@kingsds.network
 * @date October 2019
 */

require('dcp-rtlink/rtLink').link(module.paths)
const dcpConfig = require('config').load()
require('dcp-client/dist/compute.min.js')
const arg_util = require('arg_util.js')
const keystore = require('keystore.js')
const crypto = require('crypto')
const path = require('path')

const params = {
  '--requests': 100,
  '--duration': 1,
  '--batch': 1, // protocol batch size
  '--url': 'fetch/task',
  '--signed': true,
  '--help': 'boolean',
  '--body': '{}',
  '--sameKey': false,
  '--verbose': false
}

const protocols = []
let args

function help() {
  const progName = path.basename(process.argv[1])

  console.log(`
${progName} - Send a bunch of requests to some endpoint over sometime

Usage:    ${progName}
Examples: ${progName} --requests 300 --duration 2
          ${progName} --requests 1000 --duration 1 --batch 4
          ${progName} --requests 300 --duration 0

Where:
  --requests      the number of requests to send to the endpoint (default: 100)
  --duration      the time (in seconds) in which to spread the number of requests over
                  i.e. if requests is 100 and duration is 2, it will spread 100
                  requests evenly over 2 seconds (not exactly percise as it uses setTimeout)
                  special 0 means send all the requests as fast as possible (default: 1)
  --batch         the number of requests to allow the protocol to bundle together,
                  min of 1 (default: 1)
  --url           the endpoint to send the requests to, by default if it doesn't start
                  with "http" it resolve the url with this scheduler: ${dcpConfig.scheduler.location.href}
                  (default: fetch/task)
  --signed        whether or not to sign the requests that are being sent (default: true)
  --body          the content which to sign (or not) and send to the endpoint
  --sameKey       if set, use a single privatekey to sign all messages, otherwise use:
                  (requests / batch / duration) keys (default: true)
  --verbose       true to send all successes and failures to stdout, if false
                  only send number of successes (NIP) and log first failure (default: false)
  --key           NIP - the key to use to sign the requests being sent
`)
  process.exit(1)
}

async function main() {
  args = arg_util(params)
  for (let key in args) {
    if (key.startsWith('--') && typeof params[key.slice(2)] === 'undefined')
      args[key.slice(2)] = args[key]
  }

  if (args.help)
    help()

  if (args.batch < 1)
    args.batch = 1

  if (args.duration < 0)
    args.duration = 0

  if (args.requests <= 0)
    args.requests = 1

  if (!args.url.startsWith('http'))
    args.url = dcpConfig.scheduler.location.resolve(args.url)

  try {
    args.body = JSON.parse(args.body)
  } catch (e) {}

  const numProtocols = Math.ceil(args.requests / args.batch / (args.duration || 1))
  const getOriginPromises = []
  const sameKey = '0x' + crypto.randomBytes(32).toString('hex')

  for (let i = 0; i < numProtocols; i++) {
    protocols.push(new Protocol())
    protocols[i].eth.Wallet = require('ethereumjs-wallet')
    protocols[i].maxMessagesToFlush = args.batch
    protocols[i].messageFlushDelayTime = 1000
    protocols[i]._siegePrivateKey = args.sameKey ? sameKey : '0x' + crypto.randomBytes(32).toString('hex') // because the identity key kept generating the same key
    getOriginPromises.push(protocols[i].getAddressForOrigin(args.url))
  }

  console.log('Finding origin for siege protocols.')
  await getOriginPromises
  console.log('Siege has started.')
  const promises = await distributeRequestsAcrossProtocols()
  try {
    const results = await Promise.all(promises)
    if (args.verbose) {
      console.log(results)
    }
  }
  catch (error) {
    console.log(error)
    console.log('Siege success!')
    process.exit(0)
  }
  console.log('Siege has ended.')
  process.exit(1)
}

async function distributeRequestsAcrossProtocols() {
  let promises = []
  let requests = args.requests

  if (args.duration === 0) {
    while (requests > 0) {
      for (let i = 0; i < protocols.length; i++) {
        if (requests <= 0)
          break
        let requestsToSend = args.batch
        requests -= requestsToSend
        if (requests < 0)
          requestsToSend += requests
        const sends = await sendRequests(protocols[i], requestsToSend)
        promises = promises.concat(sends)
      }
    }
    return promises
  }
  
  const timeouts = []
  const delayBetweenRequests = 1000 / protocols.length
  let timeout = 0
  let timeoutPromises = []

  while (requests > 0) {
    for (let i = 0; i < protocols.length; i++) {
      if (requests <= 0)
        break
      let requestsToSend = args.batch
      requests -= requestsToSend
      if (requests < 0)
        requestsToSend += requests

      const timeoutPromise = new Promise((resolve, reject) => {
        const mytime = timeout
        let sendTimeout = setTimeout(async function dcpSiege$$distributeRequestsAcrossProtocols$sendTimeout() {
          // console.log('XXX timeout', mytime)
          const sends = await sendRequests(protocols[i], requestsToSend)
          promises = promises.concat(sends)
          resolve()
        }, timeout)
        timeouts.push(sendTimeout)
        timeout += delayBetweenRequests
      })
      timeoutPromises.push(timeoutPromise)
    }
  }

  await Promise.all(timeoutPromises)
  return promises
}

async function sendRequests(protocol, requests) {
  const promises = []
  for (let i = 0; i < requests; i++) {
    const promise = protocol.send(args.url, args.body, protocol._siegePrivateKey, !args.sign)
    promises.push(promise)
    // promise.then(console.log)
    protocol.flushBefore(0)
  }
  return promises
}

main()