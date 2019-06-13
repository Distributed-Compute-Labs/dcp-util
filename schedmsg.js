/**
 * @file schedmsg.js
 * 
 * Schedmsg provides a system to interact with the workers.
 * 
 * schedmsg.js will convert info from command line arguments to objects. The
 * objects will be sent to protocol.js to sign and send the message
 * 
 * @author Sam Cantor, samcantor@kingsds.network
 * @date May 2019
 */

const path = require('path')
const process = require('process')



function help () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Send messages to the scheduler and workers

Usage:   ${progName} --type='' --body='' --persistent='t/f'
Example: ${progName} --type='broadcast' --body='Hello World!' --persistent=true

Where:
  --type          type of message being send (broadcast)
  --body          the message to sign and send
  --persistent    whether the message should be persistent (default: false)
`)
  process.exit(1)
}

var argv = require('yargs').argv

async function start () {
  if (!argv.type && !argv.body && !argv.persistent) {
    help()
    return
  }
  let type = argv.type
  let body = argv.body
  let persistent = false
  if (argv.persistent)
    persistent = true
  sendMessage(type, body, persistent)
}

async function sendMessage (type, body, persistent) {
  let result
  let msg = {"type" : type, "payload" : body, "persistent" : persistent, "timestamp" : 0}
  try {
      result = await protocol.send('/msg/send', msg)
  } catch (error) {
    result = error
  }
  console.log(result)
  protocol.disconnect()
}

start()