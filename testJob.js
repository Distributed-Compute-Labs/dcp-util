#!/usr/bin/env node
const miner = require('../src/node/miner.js')

const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('Job File Location:', answer => {
  let file = fs.readFileSync(answer)
  console.log(file.toString())
  let job = JSON.parse(file.toString())

  let next = function (index) {
    console.log('Running Test ' + index)
    miner.run(job, job.tests[index]).then(message => {
      console.log('Test ' + index + ' Results: ', message)
      if (job.tests.length > ++index) next(index)
      else miner.close().then(message => process.exit(0))
    })
  }

  console.log('Starting Miner')
  miner.start()
    .then(message => {
      console.log(message)
      next(0)
    })
    .catch(error => {
      console.log(error)
      process.exit(1)
    })
})
