/**
 * @file    dcp-minimal-env.js
 *          Sets up an environment while in node to be able to load code to
 *          deploy a job quickly.
 *          Example of usage:
 *          * node
 *          * .load dcp-minimal-env.js
 *          * .load anotherFileThatCreatesAJobAndExecutesIt.js
 *          This file currently works with ./deploy-a-job.js
 *
 *          The file currently contains hardcoded keystore information. In the
 *          future, this file could be converted into a proper utility.
 *
 * @author  Christopher Roy
 * @date    August 2019
 */

// --- DCP environment, minimal setup ---
if (process.argv.length == 1) process.argv.push('./dcp-minimal-env.js')
require('dcp-rtlink/rtLink').link(module.paths)
if (!global.dcpConfig) {
  require('config').load()
}
require('dcp-client/dist/compute.min.js')

// --- 8< --- 8< ---
// const PRIV_KEY = '0xfc70ed12faf697c846b78458c1366880bb139a3560f2a322c80137c622a6b03e'
// const ADDRESS = '0xf56ffa118fc2f8902d30857db1eeb227753f586f'
const KEYSTORE = { 'version': 3, 'id': '3706df1d-72b8-4f84-ab95-dfa541f2e069', 'address': 'ee99b19c0e4636499db6e502c9486189777fbc30', 'crypto': { 'ciphertext': '9ff5b2004c6f3644a336218b0fcd4015c9a61024b7cfb466bf00877ae0e46d59', 'cipherparams': { 'iv': 'd20c6003cb07ca89eef22605c2834e9e' }, 'cipher': 'aes-128-ctr', 'kdf': 'scrypt', 'kdfparams': { 'dklen': 32, 'salt': '8c6410c2a0f2271c7a74b75efbb93f973cf6e94110e40a7b6854aa907f889a60', 'n': 1024, 'r': 8, 'p': 1 }, 'mac': '884a5dfe9f4414b2ec2539cd74422b1239cf9b86f09477d7cf52bbe54a0b785e' }, 'label': 'default', 'lastActive': true, 'flags': 0 }
const KEYSTORE_PWD = ''
protocol.keychain.addPrivateKey_fromEthV3Keystore(KEYSTORE, KEYSTORE_PWD, true)
// var paymentWallet = protocol.keychain.keys['0e57be8a17277bfb669d253c74cf89be1900c72b'].wallet
const paymentWallet = protocol.keychain.keys['ee99b19c0e4636499db6e502c9486189777fbc30'].wallet

console.log('Payment Wallet: ', paymentWallet)

function setWallet (w = paymentWallet) {
  protocol.keychain.addWallet(w)
  protocol.keychain.addPrivateKey(w.getPrivateKeyString(), true)
}

let g

function catchGen (gen) {
  console.log('Generator connected', gen.id)
  gen.addListener('result', ev => console.log('Result', ev.sliceNumber))
  gen.addListener('duplicate-result', ev => console.log('Dupe', ev.sliceNumber, ev.changed ? 'changed' : 'same'))
  gen.addListener('complete', ev => console.log('Complete'))
  gen.addListener('cancel', ev => console.log('Generator cancelled'))
  return gen
}

function reconnect (address, w = paymentWallet) {
  return Generator.resume(address, w).then(catchGen)
}

function go (g = global.g) {
  const d1 = Date.now()
  g.exec(ro.length)
  g.on('complete', () => {
    const d2 = Date.now()
    console.log('Completed; took ' + ((d2 - d1) / 1000).toFixed(3) + 's')
  })
}

function progress (n) {
  console.log('progress', n)
  return true
}

function missing (g = global.g) {
  const gone = []
  for (let i = 0; i < g.results.length; i++) {
    if (!g.results[i]) { gone.push(i) }
  }
  return gone
}

function expandObj (obj) {
  Object.keys(obj).forEach(k => {
    var v = obj[k]
    console.log(
      `${k}:`,
      ['string', 'number', 'boolean'].indexOf(typeof v) === -1
        ? (Array.isArray(obj)
          ? '{array}'
          : `{${typeof v}}`)
        : JSON.stringify(v)
    )
  })
}

console.log('Ready to load your code...')
