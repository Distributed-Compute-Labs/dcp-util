/**
 *  @file resubmitter.js
 *
 *  Simple node process that will check for pending tasks that are past thier
 *  expected completion time and request that the board puts them back onto
 *  the heap.
 *
 *  Will be run from a cronjob, every X minutes.
 *
 *  @author Matthew Palma, mpalma@sparc.network
 *  @date June 2018
 *
 *  @requires database
 *  @requires logger
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

/**
 * The algorithm that checks if a task is old.
 *
 * @param {number} timing - the timing for the task it's job
 * @param {number} mtime - of the pending task
 * @returns {bool} - true if old, false otherwise
 */
var isOld = (timing, mtime) => {
  if (timing < MIN_TASK_TIME || !timing) {
    timing = MIN_TASK_TIME
  } else if (timing > MAX_TASK_TIME) {
    timing = MAX_TASK_TIME
  }
  return (NOW - mtime > timing)
}

/**
 * Checks to see if a task is past its expected completion time.
 *
 * @param {string} taskName - the name of the task to check
 * @returns {Promise} - resolves with the task if old, an Error otherwise
 */
var checkIfOld = (taskName) => {
  return new Promise((resolve, reject) => {
    database.read(`tasks/pending/${taskName}`, false)
      .then(task => {
        task = task.message
        database.read(`jobs/open/${task.job}`, false)
          .then(job => {
            job = job.message
            let timing = parseFloat(job.exports[task.request].timing)
            if (typeof timing !== 'number' || Number.isNaN(timing)) {
              reject(new Error(`Job "${job.address}" timing is invalid for request "${task.request}"`))
              return
            }
            database.status(`tasks/pending/${taskName}`, false)
              .then(stats => {
                if (isOld(timing, stats.mtime)) {
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

/**
 * Gets a list of pending tasks that are past thier
 * expected completion time.
 *
 * @returns {Promise} - resolves a list of out of date classes
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

/**
 * Attempts to resubmit a task and put it back on the heap.
 *
 * @param {Object} task - the task that needs to be resubmitted
 * @returns {Promise} - resolves true when successfuly resubmits, rejects with an Error otherwise
 */
var resubmitTask = (task) => {
  return new Promise((resolve, reject) => {
    task.payment = parseFloat(task.payment)
    if (typeof task.payment !== 'number' || Number.isNaN(task.payment) || task.payment <= 0) {
      logger.log('No payment found on task ' + task.address)
      reject(new Error('No payment found on task ' + task.address))
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
                    resolve(true)
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

/** Gets old tasks and puts them back on the heap */
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
