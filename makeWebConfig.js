#! /usr/bin/env node
/**
 * @file        makeWebConfig.js        Extract relevant configuration information from
 *                                      this host and format it to be usable from the web
 *                                      content via script tag.
 *
 *                                      In addition to the usual DCP configuration, this
 *                                      program also loads etc/dcp-site-config-web.js, so
 *                                      that we can document external-facing URLs.
 *
 * @author      Wes Garland, wes@kingsds.network
 * @date        July 2018
 */
require('dcp-rtlink/rtLink').link(module.paths)
const process = require('process')
const path = require('path')
const rtlink = require('dcp-rtlink/rtLink')
const config = require('config')

config.addConfigFile(path.join(rtlink.installLocation, 'etc', 'dcp-site-config-web.js'))
config.load()

/* Only properties whose names String.match a whiteList will be emitted into 
 * the web-facing config file (www/docs/etc/dcp-config.js) when creating a 
 * safe subset.
 *
 * Two whitelists are considered for each property:
 *  - default: considered for all properties
 *  - someName: considered for properties of dcpConfig.someName.
 */
const whiteLists = {
  default: [ 'hostname', 'port', 'protocol', /[a-z]U[rR][lL]$/ ]
}

function safeSubset(label) {
  var copy = {}
  var o = dcpConfig[label]
  var whiteList = whiteLists[label]
  var p, tmp

  if (!whiteList)
    whiteList = whiteLists.default

  for (p in o) {
    if (o.hasOwnProperty(p)) {
      for (let i = 0; i < whiteList.length; i++) {
        switch (typeof whiteList[i]) {
        case 'string':
          if (whiteList[i] === p) {
            copy[p] = o[p]
          }
        case 'object':
          if (whiteList[i] instanceof RegExp && p.match(whiteList[i])) {
            copy[p] = o[p]
          }
          break
        case 'function':
          if ((tmp = whiteList[i](p))) {
            copy[p] = tmp
          }
          break
        }
      }
    }
  }

  return copy
}

/** This object becomes the web config JSON that is loaded by SCRIPT tag in apps */
var webConfig = {
  scheduler: safeSubset('scheduler'),
  packageManager: safeSubset('packageManager'),
  storage: safeSubset('storage'),
  bank: safeSubset('bank'),
  portal: safeSubset('portal'),
  terminal: safeSubset('terminal')
}

console.log(' * Creating ' + dcpConfig.root + '/www/docs/etc/dcp-config.js')
require('fs').writeFileSync(dcpConfig.root + '/www/docs/etc/dcp-config.js', 'var dcpConfig = ' + JSON.stringify(webConfig), 'utf-8')
