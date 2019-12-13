#! /usr/bin/env node
/**
 * @file schedmsg.js
 * 
 * Schedmsg provides a system to interact with the workers.
 * 
 * schedmsg.js will convert info from command line arguments to objects. The
 * objects will be sent to protocol.js to sign and send the message
 * 
 * @author Sam Cantor, samcantor@kingsds.network
           Duncan Mays, duncan@kingds.network
 * @date May 2019
 */

require('dcp-rtlink/rtLink').init();

const rpn = require('request-promise-native');
const path = require('path')
const process = require('process')

const options = require('yargs')
  .usage(`$0 - Send control messages to a DCP service
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

$0 --type [message type] --payload [message content]

Examples: $0 --type 'broadcast' --payload 'Hello World!' --persistent
          $0 --type 'command' --payload 'reload'
          $0 --type 'command' --payload 'remove,0x12345'`)
  .describe('type', 'type of message being send (broadcast, command, delete)')
  .describe('payload', 'message payload to send (eg. broadcast content)')
  .describe('persistent', 'whether the message should be persistent')
  .boolean('persistent')
  .default('persistent', false)
  .describe('keystore', 'path to the keystore to use')
  .describe('scheduler', 'Specify an alternate scheduler')
  .default('scheduler', 'https://scheduler.distributed.computer/')
  .demandOption(['type','payload'])
  .hide('version')
  .epilogue(`
Options for --type 'command':
  --payload 'popupMessage, [url]'     opens a new tab with given url
            'reload'                  kills and reloads workers 
            'restart'                 stop and refreshes workers without reloading the entire worker
            'remove,[generator id]'   removes any active tasks that contain a given generator id`)
  .argv;


function help () {
  require('yargs').showHelp();
  
  process.exit(1);
}

//loads the compute and protocol APIs, and attaches a key to protocol so that the message can be verified
async function loadCompute(entryPoint) {
  await require('dcp-client').init(entryPoint);
  
  // Load the keystore:
}

async function sendMessage (msg) {
  //adds a timestamp to the msg, all the other information and formatting is already complete
  msg.timestamp = Date.now()

  let result

  try {
    const wallet = await require('dcp/wallet').get(options.keystore);
    
    const scheduler = options.scheduler 
      ? new (require('dcp/dcp-url').URL)(options.scheduler) 
      : require('dcp/dcp-config').scheduler.location;

    //calls the needed route
    console.log('x1: sending...', scheduler.toString(), msg);
    result = await require('dcp/protocol').send(scheduler.resolve('msg/send'), msg, wallet);
  } catch (error) {
    //logs the error
    console.error('send failed', error)
    result = error
  }
  //disconnects from protocol
  require('dcp/protocol').disconnect()

  //returns the error for analysis, returns null if no error occured
  return result
}

async function start () {
  //the message sent to the scheduler will be configuired by the caller of this program using CLI arguements

  const msg = {}

  msg.type = options['type']
  msg.persistent = options['persistent']
  //mimic worker objects will be true so that they can skip steps
  msg.mimic = false

  switch (msg.type) {
    case 'command':
      let payload = options['payload']
      let a = payload.split(',')
      switch (a[0]){
        case 'popupMessage':
          msg.payload = {
            command: 'openPopup',
            href: a[1]
          }
          break
        case 'reload':
          msg.payload = {
            command: 'reload',
            perform: true
          }
          break
        case 'restart':
          msg.payload = {
            command: 'restart',
            perform: true
          }
          break
        case 'remove':
          msg.payload = {
            command: 'remove',
            perform: true,
            genId : a[1]
          }
          break
        default:
          console.log(`Error: ${a[0]} is not a valid message payload`)
          help()
          process.exit(1)
      }
      msg.persistent = false
      break

    case 'broadcast':
      msg.payload = options['payload']
      break

    case 'delete':
      msg.payload = 'delete'
      break
    default:
      console.log(`Error: ${msg.type} is not a valid message type`)
      help()
      process.exit(1)
      
  }

  const result = await sendMessage(msg)
  
  console.log('Result:', result)

  //exits the program without error flag
  process.exit(0)
}

loadCompute(options.scheduler || undefined)
.then(() => start());
