#! /usr/bin/env node

/** @file
 *  @author     Eddie Roosenmaallen, eddie@kingsds.network
 *  @date       May 2019
 *
 *  This tool imports a list of email addresses and SPARC balances, ensures all users
 *  exist in the portal db and have default keystores, then transfers DCCs to them within
 *  the bank
 */

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()

require('dcp-client/dist/compute.min.js')

const fs = require('fs')
const path = require('path')
const process = require('process')
const sha512 = require('js-sha512')
const url = require('url')

const database = require('database.js')
database.init(dcpConfig.portal.database)

const defaultBank = dcpConfig.bank.location.href

var debug = process.env.DCPDP_DEBUG || process.env.DEBUG || ''

const argvZero = require('path').basename(__filename)

// Define CLI option aliases
const optKeys = {
  '--help': 'help',
  '-h': 'help',
  '-?': 'help',
  
  '--keystore': 'keystore',
  '-k': 'keystore',
  
  '--bank': 'bank',
  '-b': 'bank',
  
  '--transfer-dcc': 'transfer',
  
  // '-': '-',    // if a parameter is simply "-", treat it as 'filename=STDIN' (NYI)
}

// Process CLI options
var options = {}
for (let i = 2; i < process.argv.length; i++) {
  const values = process.argv[i].split('=')
  const key = optKey(values[0])
  let value = values.length === 1 ? true : optVal(values[1])
  
  if (key === '@')
    value = values[0]
  // else if (key === '-') {
  //   key = '@'
  //   value = '-'
  // }
  
  options[key] = value
  
  if (process.env.DEBUG_CLI) {
    console.log('xxx', {values, key, value})
  }
}

if (process.env.DEBUG_CLI) {
  console.log('CLI:', process.argv)
  console.log('final options:', options)
  process.exit(0)
}

// Normalize a CLI option name
function optKey(str) {
  if (str.startsWith('-') && optKeys.hasOwnProperty(str))
    return optKeys[str]
  
  // if (str === '-')
  //   return '-'

  if (fs.existsSync(path.resolve(str)))
    return '@'
  
  return str.replace(/^-+/, '')
}

function optVal(str) {
  switch (str) {
    case 'true':
    case 'yes':
    case 'on':
      return true
    case 'false':
    case 'no':
    case 'off':
      return false
  }
  
  return str
}

const usage = () => {
  console.log(`
${argvZero} - Utility to mass-import email accounts to the DCP Portal
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.

Usage:  ${argvZero} OPTIONS [filename]

Where:
  [filename]    
  --help        Display this usage screen

  --keystore=/path/to/your.keystore
                Path to keystore file (default: ask, look for ./myDCPKey.keystore)
  --transfer    Transfer specified credits to each listed user (default: create accounts 
                and keystores, but don't move credits)
  --bank={bankURL}
                URL to reach out to the bank. Default: ${defaultBank}

Environment:
  DEBUG         If truthy, enable debug mode. If a string, treat as a list of extended debug flags
                (eg. DEBUG="verbose protocol" to enable DEBUG mode, with the "verbose" and "protocol" flags)
  DCP_KEYSTORE_PASSWORD
                If present, use its value as the keystore password (default: prompt for password)
`)
  
  // console.log('CLI options:', options)
  
  process.exit(1)
}

async function doImports(transferDCCs = false) {
  // if (options['@'] === '-')
  
  const lines = fs.readFileSync(path.resolve(options['@']), 'utf-8').split(/\n/)
  const accounts = lines.map(l => JSON.parse('['+ l +']'))
  
  let bankWallet = null
  let bankPrivkey = null
  
  if (options.transfer) {
    const v3 = JSON.parse(fs.readFileSync(path.resolve(options.keystore), 'utf-8'))
    bankWallet = require('ethereumjs-wallet').fromV3(v3, process.env.DCP_KEYSTORE_PASSWORD || '')
    bankPrivkey = bankWallet.getPrivateKeyString()
  }
  
  const bankURL = options.bankURL || defaultBank
  
  for (let [email, balance] of accounts) {
    console.log(' ->', email, balance)
    let [u] = await database.call('viewUser', [email])
    
    if (u.length) {
      console.log('    Found!', u[0].id, u[0].email, u[0].verified)
    } else {
      const salt = sha512(email + Date.now() + Math.random())
      const [,result] = await database.call('newUser', [email, database.binaryHex(salt)], ['userid'])
      u[0] = {
        id: result[0]['@userid'],
        email,
        verified: 1,
      }
      const verificationCode = sha512(email + Date.now() + Math.random()).slice(0, 32)
      await database.call('newVerification', [
        u[0].id,
        database.binaryHex(verificationCode)
      ])
      await database.call('verifyEmail', [
        u[0].id,
        database.binaryHex(verificationCode)
      ])

      console.log('    made new:', u[0].id, u[0].email)
    }
    
    const user = u[0]
    const userid = user.id
    
    let [keystores] = await database.call('viewLastActiveKeystore', [userid])
    let address = '0x0000'
    
    if (keystores.length) {
      address = '0x'+ keystores[0].address.toString('hex')
      console.log('    Loaded keystore', address)
    }
    else {
      const keystore = protocol.createKeystore(require('ethereumjs-wallet').generate(), '')
      keystore.label = 'SPARC Alpha'
      const bob = await database.call('newKeystore', [
        userid,
        database.binaryHex(keystore.address),
        keystore.label,
        JSON.stringify(keystore),
        true,
        false
      ]);
      [keystores] = await database.call('viewLastActiveKeystore', [userid])
      address = '0x' + keystores[0].address.toString('hex')
      console.log('    Made keystore', address)
    }
    
    if (balance && options.transfer) {
      console.log(`    Giving ${balance} DCCs...`)
      
      const success = await protocol.send(
        `${bankURL}/bank/move`,
        {
          toAddress: address,
          amount: balance
        },
        bankPrivkey
      ).then(ev => {
        return true
      }).catch(err => {
        return false
      })

      console.log(`    gave!`, success)
    }
  }
}

if (options.help || process.argv.length <= 2) {
  usage()
}
else if (options.debug) {
  console.log('Debug mode!')
  console.log('options = ', options)
}
else {
  doImports(options.transfer).then(ev => {
    console.log('Complete.', ev)
    process.exit(ev && ev.errorlevel || 0)
  })
}
