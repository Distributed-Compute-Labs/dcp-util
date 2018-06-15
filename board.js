const express = require('express')
const app = express()
const server = require('http').Server(app)

var config = {
  listen_port: process.env.DCPMS_LISTEN_PORT || '3000',
  listen_host: process.env.DCPMS_LISTEN_HOST || '127.0.0.1'
}

// This can be a rule in nginx.conf
app.use(express.static('examples'))
app.use(express.static('src'))
app.use(express.static('utilities'))
app.use(express.static('node_modules'))

// CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

// this stuff should be moved to a util file somewhere
var getBody = function (stream) {
  return new Promise((resolve, reject) => {
    let chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', e => reject(e))
  })
}

const version = '0.0.3'
const logger = require('../src/node/logger.js')
logger.createLog('DCP BOARD VERSION ' + version + '\n', 'board')

// for debugging unhandled promises
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  logger.log('Unhandled Rejection at: Promise ' + JSON.stringify(p), 'reason: ' + JSON.stringify(reason))
})

// Body parser
app.use((req, res, next) => {
  logger.log([
    'HTTP',
    req.httpVersion,
    req.method,
    req.url,
    '\n'
  ].join(' '))

  getBody(req)
    .then(body => {
      body = body.toString()

      try {
        body = JSON.parse(body)
      } catch (e) {}

      req.body = body
      next()
    })
    .catch(error => console.log('request body could not be parsed', error))
})

/**
 * Command line options
 *
 * npm start arg1 arg2=val2 arg3 ..
 *
 * EG: npm start dev port=3000
 */

var options = {
  bank: false,
  board: false,
  fork: false
}

for (let i = 0; i < process.argv.length; i++) {
  let values = process.argv[i].split('=')
  switch (values[0]) {
    case 'bank':
    case 'board': // not sure any of these are used anymore except fork
    case 'fork':
      options[values[0]] = true
      break
    case 'database':
      global.database = require('../src/node/database.js')
      global.database.setPath(values[1])
      break
  }
}

app.get('/status', function (req, res) {
  res.status(200).end()
})

// if(options.board){
const board = require('../src/node/board.js')
const io = board.init(app, {}, server)
// }

// if(options.bank){
const bank = require('../src/node/bank.js')
bank.init(app, {}, server)
// }

server.listen(config.listen_port, config.listen_host)

console.log('Board Server listening on ' + config.listen_host + ':' + config.listen_port)

// http://glynnbird.tumblr.com/post/54739664725/graceful-server-shutdown-with-nodejs-and-express
let gracefulShutdown = function () {
  io.close(
    function () {
      io.destroy()
      server.close(function () {
        process.exit()
      })
    }
  )

  setTimeout(function () {
    console.error('Could not close connections in time, forcefully shutting down')
    process.exit()
  }, 5 * 1000)
}

// listen for TERM signal .e.g. kill
process.on('SIGTERM', gracefulShutdown)

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', gracefulShutdown)

module.exports = {
  app,
  server,
  config
}

if (options.fork) {
  process.send({
    request: 'Server Started',
    config
  })
}
