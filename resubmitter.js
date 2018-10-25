#! /usr/bin/env node

/**
 *  @file resubmitter.js
 *
 *  Simple node process that will check for pending tasks that are past thier
 *  expected completion time and request that the board puts them back onto
 *  the heap.
 *
 *  Used as a forked node process from the board
 *
 *  Usage (to start from inside a  node instance, 'env' opt is optional):
 *    `require('child_process').fork('./pathToBin/resubmitter.js', [], { env: DCP_SITE_CONFIG_FILES: 'path to config' })`
 *
 *  Example: `require('child_process').fork('./resubmitter.js', [])`
 *
 *  Usage (to start from outside a node instance, env variable is optional):
 *    `DCP_SITE_CONFIG_FILES='path to config' node resubmitter.js`
 *
 *  Example: `node bin/resubmitter.js`
 *
 *  @author Matthew Palma, mpalma@sparc.network
 *  @date June 2018
 *
 *  @requires database
 *  @requires logger
 */

/* global dcpConfig */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()

const database = require('database.js')

const protocol = require('../lib/protocol-node.js')

const version = '0.0.1'
const logger = require('logger.js')
logger.createLog('DCP TASK RESUBMITTER ' + version + '\n', 'resubmitter')

var config = dcpConfig.resubmitter
config.debug = process.env.DCP_DEBUG || true

/**
 * The algorithm that checks if a task is old.
 *
 * @param {number} timing - the timing for the task it's job
 * @param {number} mtime - of the pending task
 * @returns {bool} - true if old, false otherwise
 */
var isOld = (timing, mtime) => {
  if (timing < config.minTaskTime || !timing) {
    timing = config.minTaskTime
  } else if (timing > config.maxTaskTime) {
    timing = config.maxTaskTime
  }
  return (Date.now() - mtime > timing)
}

/**
 * Checks to see if a task is past its expected completion time.
 *
 * @param {string} taskName - the name of the task to check
 * @returns {Promise} - resolves with the task if old, an Error otherwise
 */
var checkIfOld = (taskName) => {
  return new Promise((resolve, reject) => {
    return database.read(`tasks/pending/${taskName}`, false)
      .then(task => {
        task = task.message
        return database.read(`jobs/open/${task.job}`, false)
          .then(job => {
            job = job.message
            let timing = parseFloat(job.exports[task.request].timing)
            if (typeof timing !== 'number' || Number.isNaN(timing)) {
              reject(new Error(`Job "${job.address}" timing is invalid for request "${task.request}"`))
              return
            }
            return database.status(`tasks/pending/${taskName}`, false)
              .then(stats => {
                if (isOld(timing, stats.mtime)) {
                  resolve(task)
                } else {
                  if (config.debug) {
                    console.log(Date.now() - stats.mtime, timing)
                  }
                  reject(new Error('Task is not old.'))
                }
              })
          })
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
    return database.listDirectory('tasks/pending')
      .then(async taskNames => {
        let oldTasks = []
        for (let taskName of taskNames) {
          try {
            let oldTask = await checkIfOld(taskName)
            oldTasks.push(oldTask)
          } catch (e) {
            console.log(e)
          }
        }
        resolve(oldTasks)
      })
      .catch(reject)
  })
}

/**
 * Attempts to resubmit a task and put it back on the heap.
 * NOTE: not currently used.
 *
 * @param {Object} task - the task that needs to be resubmitted
 * @returns {Promise} - resolves true when successfuly resubmits, rejects with an Error otherwise
 */
var resubmitTaskManually = (task) => { // eslint-disable-line
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
        return database.remove(`tasks/pending/${task.address}`, false)
          .then(removed => {
            return database.read(`jobs/open/${task.job}`, false)
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
              })
          })
      })
      .catch(onFail)
  })
}

/**
 * Attempts to resubmit a task by making a task/return request to the board
 *
 * @param {Object} task - the task that needs to be resubmitted
 * @returns {Promise} - resolves true when successfuly resubmits, rejects with an Error otherwise
 */
var resubmitTask = (task) => {
  return protocol.send(`http://${dcpConfig.board.hostname}:${dcpConfig.board.port}/return/task`, task)
}

/** Gets old tasks and puts them back on the heap */
var main = () => {
  getOldTasks()
    .then(oldTasks => {
      for (let oldTask of oldTasks) {
        resubmitTask(oldTask).catch(console.error)
      }
    })
    .catch(error => {
      logger.log(error)
      console.error(error)
    })
}

setInterval(main, config.rate)
