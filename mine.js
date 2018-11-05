#! /usr/bin/env node

/**
 *  @file miner.js
 *
 *  Depreciated.
 *  It fetches tasks from the board and runs them through ../lib/miner.js
 *
 *  @author Greg Agnew
 */
/* globals dcpConfig */
require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()

const miner = require('miner.js')
const protocol = require('protocol-node.js')

const version = '0.0.1'
const logger = require('logger.js')
logger.createLog('DCP MINER VERSION ' + version + '\n', 'miner')

// http://glynnbird.tumblr.com/post/54739664725/graceful-server-shutdown-with-nodejs-and-express
let gracefulShutdown = function () {
  process.exit()
}

// listen for TERM signal .e.g. kill
process.on('SIGTERM', gracefulShutdown)

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', gracefulShutdown)

var options = {
  board: dcpConfig.board.hostname,
  port: dcpConfig.board.port,
  privatekey: '0x56d2872484002fe72f0d2424ce293c4687a69f74741aa003dd51b71af6aa4321'
}

for (let i = 0; i < process.argv.length; i++) {
  let values = process.argv[i].split('=')
  if (values[0] === 'board') options.board = values[1]
  else if (values[0] === 'port') options.port = values[1]
  else if (values[0] === 'privatekey') options.privatekey = values[1]
}

console.log('DCP Miner running')

miner.start().then(message => {
  logger.log('Fetcing Task')
  protocol.send('http://' + options.board + ':' + options.port + '/fetch/task', {}, options.privatekey)
    .then(signedResponse => {
      signedResponse = JSON.parse(signedResponse)
      let task = signedResponse.message
      logger.log('Task Recieved ' + task.address)
      logger.log('Fetching Job ' + task.job)
      protocol.send('http://' + options.board + ':' + options.port + '/fetch/job', { 'address': task.job }).then(signedResponse => {
        signedResponse = JSON.parse(signedResponse)
        let job = signedResponse.message

        logger.log('Job Recieved ' + job.address)
        logger.log('Starting Task ' + task.address)
        miner.run(job, task).then(message => {
          logger.log('Task Complete')
          task.result = message.result

          // decide if continouing?

          // fetch task

          // if same job, use same miner

          // else close this miner open a new one

          console.log(task)

        // miner.close();
        })
      })
    })
})
