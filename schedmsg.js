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

// const rpn = require('request-promise-native') //HTTP request client 'request'
// const fs = require('fs')
// const ppromt = require('password-prompt')
// const SCHED_PATH = "https://portal.distributed.computer/etc/dcp-config.js"
// const KEYSTORE_PATH = 'myDCPKey.keystore'

//States is the message is persistent or not. By default, it is not persistent
let persistent = false
//States the type of the message. For now, the only valid type is 'broadcast'
let type = ''
//The content contains the text for the message
let content = ''

//holds the message from the command line
//skips first two slices because we know they are node and schedmsg.js
const args = process.argv.slice(2)
//searches for command line arguments and changes appropriate variables
for (let j = 0; j < args.length; j++) {
  switch (args[j]) {
    case '-b':
      // specifies type broadcast
      type = 'broadcast'
      console.log('type: broadcast')
      break
    case '-p':
      //message is persistent
      persistent = true
      console.log('message is persistent')
      break
    case '-m':
      //the content of the message
      content = args[j+1]
      console.log('the message is: '+content)
      break
  }
}

//Creates an object containing all message info
var msg = {"type" : type, "content" : content, "persistent" : persistent, "timestamp" : 0}

//this sends the message to protocol.js where it will be signed and 
//sent to the /schedmsg/send route of the scheduler
protocol.send('/schedmsg/send', msg)
//should add await?
