#!/bin/bash

# @file         job-utility-cancel-job.bash
#
#               This job deploys a singular job, and cancels it using
#               the cancelJob operation found in job-utility.
#               It then uses `compute.getJobInfo()` to check if the job
#               was really cancelled on the scheduler.
#
# @author       Joash Mathew <joash@distributive.network>
# @date         August 2023

set -eu

cd $(dirname "${0}")

if ! type node > /dev/null 2>&1; then
  echo "Node is not installed" >&2
  exit 1
fi

jobId=$(node ./common/deploy-job.js 1)

utilOutput=$(../bin/job-utility cancelJob "${jobId}")

if [[ "$?" -eq 0 && $utilOutput == *"${jobId}"* ]]; then
  status=$(node ./common/check-job-status.js ${jobId})
  if [[ $status == "cancelled" ]]; then
    echo "Test success, job cancelled on scheduler"
    exit 0
  else
    exit 1
  fi
else
  echo "cancelJob operation failed" >&2
  exit 1
fi
