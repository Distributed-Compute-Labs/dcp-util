#! /usr/bin/env node
/**
 *  @file               update-db.js
 *                      Utility to create and update all or some of the databases.
 *
 *  @author             Matthew Palma, mpalma@kingsds.network
 *  @date               Dec 2018
 */

require('dcp-rtlink/rtLink').link(module.paths)
const dcpConfig = require('config').load() // eslint-disable-line
const path = require('path')
const process = require('process')
const { fork } = require('child_process')
const protocol = require('protocol-node')

const options = {
  scheduler: {
    board: 'Y',
    bank: 'N',
    user: 'N',
    storage: 'N',
    hostname: dcpConfig.scheduler.database.hostname,
    username: dcpConfig.scheduler.database.username,
    password: dcpConfig.scheduler.database.password,
    database: dcpConfig.scheduler.database.name,
    port:     dcpConfig.scheduler.database.port
  },
  bank: {
    board: 'N',
    bank: 'Y',
    user: 'N',
    storage: 'N',
    hostname: dcpConfig.bank.database.hostname,
    username: dcpConfig.bank.database.username,
    password: dcpConfig.bank.database.password,
    database: dcpConfig.bank.database.name,
    port:     dcpConfig.bank.database.port
  },
  portal: {
    board: 'N',
    bank: 'N',
    user: 'Y',
    storage: 'N',
    hostname: dcpConfig.portal.database.hostname,
    username: dcpConfig.portal.database.username,
    password: dcpConfig.portal.database.password,
    database: dcpConfig.portal.database.name,
    port:     dcpConfig.portal.database.port
  },
  storage: {
    board: 'N',
    bank: 'N',
    user: 'N',
    storage: 'Y',
    hostname: dcpConfig.storage.database.hostname,
    username: dcpConfig.storage.database.username,
    password: dcpConfig.storage.database.password,
    database: dcpConfig.storage.database.name,
    port:     dcpConfig.storage.database.port
  }
}

function usage () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Updates the database(s) because its important
Copyright (c) 2018 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} [all, scheduler, bank, portal, storage]
         
Example: ${progName} scheduler bank
`)
  process.exit(1)
}

if (process.argv.length < 3) {
  usage()
}

async function start () {
  let databases = process.argv.splice(2)
  if (databases.indexOf('all') !== -1) {
    databases = Object.keys(options)
  }
  for (let db of databases) {
    if (!options[db]) {
      console.error(`Have no options for '${db}', skipping.`)
      continue
    }
    await updateDB(db)
  }
}

async function updateDB (db) {
  return new Promise((resolve, reject) => {
    let args = []
    let keys = Object.keys(options[db])
    for (let key of keys) {
      args.push(`${key}=${options[db][key]}`)
    }
    console.log(' * Updating database', options[db].database, 'on', options[db].hostname)
    fork(require.resolve('mysql-legacy/bin/setup.js'), args)
      .on('close', resolve)
  })
}

start()
