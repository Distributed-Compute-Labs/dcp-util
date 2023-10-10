#!/bin/bash

# @file         job-utility-cancel-all-jobs.bash
#
#               This job deploys 5 jobs, and checks that using
#               the cancelAllJob operation found in job-utility
#               will cancel them all.
#               It then uses `compute.getJobInfo()` to check if
#               the jobs were really cancelled on the scheduler.
#
# @author       Joash Mathew <joash@distributive.network>
# @date         August 2023

set -eu

cd $(dirname "${0}")

if ! type node > /dev/null 2>&1; then
  echo "Node is not installed" >&2
  exit 1
fi

jobIds=$(node ./common/deploy-job.js 5)
read -r -a jobIds <<< $jobIds

utilOutput=$(../bin/job-utility cancelAllJobs test)
for address in "${jobIds[@]}"; do
  if [[ "$?" -ne 0 && $utilOutput != *"${address}"* ]]; then
    echo "cancelJob operation did not cancel job with address: $address" >&2
    exit 1
  fi
done

statuses=$(node ./common/check-job-status "${jobIds[@]}")
read -r -a statuses <<< $statuses

if [[ ${#statuses[@]} -ne 5 ]]; then
  echo "Expected 5 cancellations, got ${#statuses[@]}." >&2
  exit 1
fi

for status in "${statuses[@]}"; do
  if [[ $status != "cancelled" ]]; then
    echo "One of the jobs did not have status cancelled" >&2
    exit 1
  fi
done
