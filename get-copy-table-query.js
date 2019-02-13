#! /usr/bin/env node
/**
 *  @file               get-copy-table-query.js
 *                      Get a mysql statement to copy one table into another.
 *
 *  @author             Matthew Palma, mpalma@kingsds.network
 *  @date               Jan 2019
 */

/* globals dcpConfig */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()
const yargs = require('yargs')
const pormdb = require('pormdb')

const schemaName = yargs.argv._[0]
const tableName = yargs.argv._[1]
const toTableName = yargs.argv._[2]
const ingoredColumns = yargs.argv._.slice(3)

function usage () {
  var progName = require('path').basename(process.argv[1])

  console.log(`
${progName} - Get a mysql statement to copy one table into another.
Copyright (c) 2018 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} <schemaName> <fromTable> <toTable> [ignoredColumns]

Arguments:
  schemaName      - the name of the schema where the fromTable exists [bank, portal, or scheduler]
  fromTable       - the name of the table to copy rows from
  toTable         - the name of the table to copy rows into
  ignoredColumns  - the name of columns to ignore in the copy

Example: ${progName} scheduler heap heap_new id
`)
  process.exit(1)
}

async function start () {
  if (yargs.argv.h) {
    usage()
  }

  if (typeof dcpConfig[schemaName] === 'undefined' || typeof dcpConfig[schemaName].ormdb === 'undefined') {
    console.error(`No schema named: '${schemaName}' exists.`)
    return
  }

  let db = await pormdb.createConnection(dcpConfig[schemaName].ormdb)
  try {
    let query = db.connection.dbConn.getCopyTableQuery(tableName, toTableName, ingoredColumns)
    console.log(query)
  } catch (error) {
    console.error(error)
  }

  db.disconnect()
}

start()
