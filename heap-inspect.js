#!/usr/bin/node
/**
 *  @file       heap-inspect.js
 * 
 *  An admin utility to query the scheduler's heap admin endpoints,.
 * 
 *  There also exists a webpage to query these endpoints, it is hosted at:
 *  https://scheduler-url/www/admin/admin-heap.html
 *
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       Nov 2019
 */

require('dcp-rtlink/rtLink.js').link(module.paths);
require('config').load();

const protocol = require('../src/node/protocol-node.js');
const { URL } = require('../src/dcp-url.js');

const argvZero = require('path').basename(__filename);

const adminEndpoint = '/admin/heap';
const statsEndpoint = '/heap/stats';

const BRIGHT_TEXT = '\x1b[1m';
const BLUE_TEXT = '\x1b[34m';
const UNDSCR_TEXT = '\x1b[4m';
const RESET_TEXT = '\x1b[0m';
const MGNTA_TEXT = '\x1b[35m';

// Demo scheduler
// const schedulerURL = new URL('https://scheduler-demo.distributed.computer');
// const schedulerKey = '0xd64ab96ab8d5bae345b237b98b635c250f3770b3b85081247d42f8085e7b90d2';

// Ryan's scheduler
// const schedulerURL = new URL('http://scheduler.ryan.office.kingsds.network');
// const schedulerKey = '0xd6d2872484002fe72f0d2424ce293c4687a69f74741aa003dd51b71af6aa4321';

const usage = () => {
  console.log(`
${argvZero} - An admin utility to query the scheduler's heap admin endpoints
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:  ${BRIGHT_TEXT}${argvZero} ${MGNTA_TEXT}[schedulerURL] [privateKey]${RESET_TEXT}

The provided private key must have its address whitelisted in the scheduler to be accepted.


There also exists a webpage to query these endpoints, it is hosted at:
    ${UNDSCR_TEXT}${BLUE_TEXT}https://scheduler-url/www/admin/admin-heap.html${RESET_TEXT}
`)

  process.exit(1);
}

const requestFromScheduler = (schedulerURL, schedulerKey, endpoint) => {
  console.log('\nRequesting scheduler endpoint:', endpoint);

  const url = schedulerURL.resolve(endpoint);
  let promise = protocol.send(url, {}, schedulerKey).then(
    result => {
      console.log('Received response:', result);
      return result;
    },
    error => console.error(error)
  );

  return promise;
}

const main = async (schedulerStrURL, schedulerKey) => {
  const schedulerURL = new URL(schedulerStrURL);

  console.log("Inspecting heap from scheduler at", schedulerURL.href);
  const snapshot = await requestFromScheduler(schedulerURL, schedulerKey, adminEndpoint);
  const stats = await requestFromScheduler(schedulerURL, schedulerKey, statsEndpoint);

  debugger; // in case you want to inspect the snapshot or stats. allow-debugger
  process.exit(1); // Don't wait for any promises that are left hanging around
}

const args = process.argv.slice(2); // removes node and the script filename
if (args.length < 2) {
  usage();
} else {
  main(...args);
}
