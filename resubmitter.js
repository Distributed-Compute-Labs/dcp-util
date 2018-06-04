/*
 * @file resubmitter.js
 * Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 * Simple node process that will check for pending tasks that are past thier
 * expected completion time and request that the board puts them back onto
 * the heap.
 *
 * Will be run from a cronjob, every X minutes.
 *
 * @author Matthew Palma, mpalma@sparc.network
 * @date June 2018
 */

var args = [].concat(process.argv).slice(2)
const database = require('../src/node/database.js')
database.setPath(args[0] || '../db/')

const version = '0.0.1'
const logger = require('../src/node/logger.js')
logger.createLog('DCP TASK RESUBMITTER ' + version + '\n', 'resubmitter')

const MAX_TASK_TIME = 1000 * 60 * 10 // 10 minutes
const MIN_TASK_TIME = 1000 * 60 * 1 // 1 minute
const NOW = Date.now()

/*
 * Checks to see if a task is past its expected completion
 * time. If so, return the task, otherwise reject.
 */
var checkIfOld = (taskName) => {
  return new Promise((resolve, reject) => {
    database.read(`tasks/pending/${taskName}`, false)
      .then(task => {
        task = task.message
        let job = task.job
        database.read(`jobs/open/${job}`, false)
          .then(job => {
            job = job.message
            let timing = job.exports[task.request].timing
            if (timing < MIN_TASK_TIME || !timing) { timing = MIN_TASK_TIME } else if (timing > MAX_TASK_TIME) { timing = MAX_TASK_TIME }
            database.status(`tasks/pending/${taskName}`, false)
              .then(stats => {
                if (NOW - stats.mtime > timing) {
                  resolve(task)
                } else {
                  console.log(NOW - stats.mtime, timing)
                  reject(new Error('Task is not old.'))
                }
              })
              .catch(reject)
          })
          .catch(reject)
      })
      .catch(reject)
  })
}

/*
 * Gets a list of pending tasks that are past thier
 * expected completion time.
 */
var getOldTasks = () => {
  return new Promise((resolve, reject) => {
    database.listDirectory('tasks/pending')
      .then(async taskNames => {
        let oldTasks = []
        for (let taskName of taskNames) {
          console.log(taskName)
          await checkIfOld(taskName)
            .then(oldTask => oldTasks.push(oldTask))
            .catch(e => console.log(e))
        }
        resolve(oldTasks)
      })
      .catch(reject)
  })
}

/*
 * Attempts to resubmit a task and put it back on the heap.
 */
var resubmitTask = (task) => {
  return new Promise((resolve, reject) => {
    if (typeof task.payment === 'undefined' || task.payment <= 0) {
      logger.log('No payment found on task ' + task.address)
      return
    }

    delete task.miner

    let onFail = (error) => {
      // console.log(error);
      logger.log(error)
      reject(error)
    }

    database.write(`tasks/open/${task.address}`, task, false)
      .then(event => {
        database.remove(`tasks/pending/${task.address}`, false)
          .then(removed => {
            database.read(`jobs/open/${task.job}`, false)
              .then(job => {
                job = job.message
                if (!job.exports[task.request].timing) {
                  reject(new Error('Job has no timing for task.'))
                  return
                }
                let heapName = task.payment / job.exports[task.request].timing
                heapName += '-t-' + task.address
                database.write(`heap/${heapName}`, '', false)
                  .then(event => {
                    resolve(event)
                  })
                  .catch(onFail)
              })
              .catch(onFail)
          })
          .catch(onFail)
      })
      .catch(onFail)
  })
}

var main = () => {
  console.log('main')
  getOldTasks()
    .then(async oldTasks => {
      for (let oldTask of oldTasks) {
        await resubmitTask(oldTask)
          .catch(console.error)
      }
    })
    .catch(error => {
      logger.log('Error: ' + JSON.stringify(error))
      console.error(error)
    })
}

main()
