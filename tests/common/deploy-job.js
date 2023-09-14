#! /usr/bin/env node

/**
 * @file        deploy-job.js
 *              This script deploys `x` number of jobs, prints the job addresses
 *              and exits.
 *              x is a number passed into the command line call of the program,
 *              and defaults to 3 if nothing is provided, or the input is invalid.
 *
 * @author      Joash Mathew, <joash@distributive.network>
 * @date        August 2023
 *
 */

'use strict';

function deployJob()
{
  return new Promise((resolve, reject) => {
    const compute = require('dcp/compute');

    const job = compute.for([1,2,3,4,5], (num) => { progress(); return num; });

    job.on('accepted', (ev) => { return resolve(ev.id) });
    job.exec().catch(reject);
    job.unref();
  });
}

async function deployJobs()
{
  let jobsToDeploy = 3;
  let argvLength = process.argv.length;
  if (process.argv[argvLength - 1])
  {
    if (!isNaN(process.argv[argvLength - 1]))
      jobsToDeploy = process.argv[argvLength - 1];
  }

  let ids = [];
  for (let i = 0; i < jobsToDeploy; i++)
    ids.push(await deployJob());

  console.log(ids.join(' '));
}

require('dcp-client')
  .init()
  .then(deployJobs)
  .catch((error) => {
    console.error('Job deploy failed due to', error);
    process.exit(1);
  });
