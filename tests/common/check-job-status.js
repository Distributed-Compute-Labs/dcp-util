#! /usr/bin/env node

/**
 * @file        check-job-status.js
 *              This script takes job addresses provided by the user from the
 *              command-line and returns the `status`(es) of the job(s), as 
 *              reported by `compute.getJobInfo()`
 *
 * @note        If this script is run without running it specifically as a node
 *              program (i.e., executing as `node check-job-status.js`), one
 *              of your addresses will get ommitted.
 *
 * @author      Joash Mathew, <joash@distributive.network>
 * @date        August 2023
 *
 */

'use strict';

async function check()
{
  const compute = require('dcp/compute');
  let jobStatuses = [];
  for (let i = 2; i < process.argv.length; i++)
  {
    jobStatuses.push((await compute.getJobInfo(process.argv[i])).status);
  }

  console.log(jobStatuses.join(' '));
}

require('dcp-client').init().then(check);
