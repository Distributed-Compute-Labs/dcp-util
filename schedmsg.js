#! /usr/bin/env node
/**
 * @file schedmsg.js
 * 
 * Schedmsg provides a system to interact with the workers.
 * 
 * schedmsg.js will convert info from command line arguments to objects. The
 * objects will be sent to protocol.js to sign and send the message
 * 
 * @author Ryan Rossiter, ryan@kingsds.network,
 *         Sam Cantor, samcantor@kingsds.network
 *         Duncan Mays, duncan@kingds.network
 * @date May 2019
 */

const process = require('process');

require('yargs')
.usage(`$0 - Send control messages to a DCP service
Copyright (c) 2020 Kings Distributed Systems Ltd., All Rights Reserved.`)
.command('announce <message>',
  'Send an announcement to workers, will display a modal or log to console', {},
  (options) => sendMessage(options, 'announce', { message: options.message }))
.command('remove <jobAddress>', 
  'Removes any active slices for job address', {},
  (options) => sendMessage(options, 'remove', { jobAddress: options.jobAddress }))
.command('openPopup <href>',
  'Opens a new tab on browser workers', {},
  (options) => sendMessage(options, 'openPopup', { href: options.href }))
.command('reload',
  'Forces a reload of the worker', {},
  (options) => sendMessage(options, 'reload'))
.command('restart',
  'Stop and refreshes workers without reloading the entire worker', {},
  (options) => sendMessage(options, 'restart'))
.options({
  broadcast: {
    describe: 'when true, command will be sent to all workers connected to the scheduler (provided keystore must be in the scheduler\'s schedMsgAdmins list). When false, command will be sent to workers that use the provided keystore as their identity',
    type: 'boolean',
    default: false,
  },
  persistent: {
    describe: '(not implemented) Whether the message should be persistent',
    type: 'boolean',
    default: false,
  },
  keystore: {
    describe: 'Path to the keystore to use for authorization',
    type: 'string',
  },
  scheduler: {
    describe: 'URL of the scheduler to send the command to',
    type: 'string',
    default: 'https://scheduler.distributed.computer/',
  }
})
.demandCommand(1)
.strict().argv;


/**
 * Send the message to the scheduler
 * @param {object} options - yarg options
 * @param {string} command
 * @param {object} payload
 */
async function sendMessage (options, command, payload={}) {
  await require('dcp-client').init(options.scheduler);
  const wallet = require('dcp/wallet');
  const protocolV4 = require('dcp/protocol-v4');
  const { URL } = require('dcp/dcp-url');

  const schedulerURL = new URL(options.scheduler);
  const schedulerConnection = new protocolV4.Connection(schedulerURL.resolve('/DCPv4'));
  const keystore = await wallet.get(options.keystore);

  const message = {
    owner: keystore.address,
    broadcast: options.broadcast,
    command,
    payload,
  }

  console.log(`Sending SchedMsg to scheduler ${options.scheduler}:`, message);
  await schedulerConnection.send('sendSchedMsg', message, keystore);
  console.log(`\nCommand '${command}' sent successfully.`);

  await schedulerConnection.close();
  process.exit(0);
}
