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

require('dcp-rtlink/rtLink').link(module.paths)
const rpn = require('request-promise-native');
const dcpConfig = require('config').load()
require('dcp-client/dist/compute.min.js')
const path = require('path')
const process = require('process')
const arg_util = require('arg_util.js')
//clobbers a faulty random number generator with a better one
protocol.eth.Wallet = require('ethereumjs-wallet')
const keystore = require('keystore.js')


function help () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Send messages to the scheduler and workers

Usage:   ${progName} --type '' --payload '' --persistent t/f
Example: ${progName} --type broadcast --payload 'Hello World!' --persistent

Where:
  --type          type of message being send (broadcast, command)
  --payload       the message to sign and send
  --persistent    whether the message should be persistent (default: false)
  --keystore      specify the location of keystore to be used
`)
  //exits the program with error flag raised
  process.exit(1)
}

//loads the compute and protocol APIs, and attaches a key to protocol so that the message can be verified
async function loadCompute(keystorePath) {
  // gets neccessary configuration info from scheduler
//  eval(await rpn("http://portal.cantor.office.kingsds.network/etc/dcp-config.js"));
//  global.dcpConfig = dcpConfig;
  // injects compute and protocol into the global namespace.
//  require('dcp-client/dist/compute.min');
  // Load the keystore:
  const wallet = await keystore.getWallet(keystorePath)
  protocol.keychain.addWallet(wallet, true);
}

async function sendMessage (msg) {
  //adds a timestamp to the msg, all the other information and formatting is already complete
  msg.timestamp = Date.now()

  let result

  try {
    //calls the needed route
    console.log('x1: sending...', dcpConfig.scheduler.location.href, msg)
    result = await protocol.send('msg/send', msg)
  } catch (error) {
    //logs the error
    console.error('send failed', error)
    result = error
  }
  //disconnects from protocol
  protocol.disconnect()

  //returns the error for analysis, returns null if no error occured
  return result
}

async function start () {
  //the message sent to the scheduler will be configuired by the caller of this program using CLI arguements
  //arg_util takes a configureation object to know what arguements to look for, and returns another object describing the arguments given
  const paramObj = {'--type':'string', '--payload':'string', '--keystore':'string', '--persistent':false}
  const cliArgs = arg_util(paramObj)

  //XXXXX
  // console.log(cliArgs)

  //checks that all the needed information in msg was provided by the caller, displays a help function if not
  if (!cliArgs['--type'] && !cliArgs['--payload']) {
    console.log('You must provide a configuration for type and payload')
    help()
    //exits the program with error flag raised. help() should have already done so, but if somebody edits it and messes that up
    //this line will prevent the error from propegating
    process.exit(1)
  }

  await loadCompute(cliArgs['--keystore'])

  const msg = {}

  msg.type = cliArgs['--type']
  msg.persistent = cliArgs['--persistent']

  switch (msg.type) {
    case 'command':
      let payload = cliArgs['--payload']
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
      }
      case 'restart':
        msg.payload = {
          command: 'restart',
          perform: true
        }
        break
      msg.persistent = false
      break

    case 'broadcast':
      msg.payload = cliArgs['--payload']
      break

    case 'delete':
      msg.payload = 'delete'
      break
      
  }

  

  //XXXXX
  //console.log('msg is: ', msg)

  const result = await sendMessage(msg)
  
  console.log('Result:', result)

  //exits the program without error flag
  process.exit(0)
}

start()