#! /usr/bin/env node
/**
 *  @file               send-template-email.js
 *                      Utility to send an adhoc email via the template email
 *                      system (populateEmailTemplate et al in email.js)
 *
 *  @author             Wes Garland, wgarland@kingsds.network
 *  @date               Dec 2018
 */
require('dcp-rtlink/rtLink').link(module.paths)
const dcpConfig = require('config').load()
const path = require('path')
const process = require('process')

function usage () {
  var progName = path.basename(process.argv[1])

  console.log(`
${progName} - Send template email
Copyright (c) 2018 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:   ${progName} [switches] templateFile <fromEmail> <fromName> <to> <toName> <subject> [extra]
         (see: populateEmailTemplate in email.js)
Switches:
  --stdout     - send output to stdout instead of configured mailer
Arguments:
  templateFile - a file containing a complete e-mail message
  fromEmail    - the originator's e-mail address
  fromName     - the originator's name
  to           - the recipient's e-mail address
  toName       - the recipient's name
  subject      - the subject of the e-mail
  extra        - JSON defining extra tokens
`)
  process.exit(1)
}

let argv = process.argv.concat([]).slice(2)
let stdout = false

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--stdout') {
    argv.splice(i--, 1)
    stdout = true
  }
}

if (argv.length < 6) {
  usage()
}

if (argv[6]) {
  argv[6] = JSON.parse(argv[6])
}

let rfc822Message = require('email').populateEmailTemplate.apply(null, argv)

if (stdout) {
  console.log(rfc822Message)
} else {
  console.log(`Sending e-mail to ${argv[3]}...`)
  require('email').deliver(rfc822Message, argv[3])
}
