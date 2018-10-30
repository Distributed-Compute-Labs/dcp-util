#! /usr/bin/env node
/**
 * @file        makeWebConfig.js        Extract relevant configuration information from 
 *                                      this host and format it to be usable from the web
 *                                      content via script tag.
 *
 *                                      Use the first and second arguments to specify parameters
 *                                      to require('config').load()
 *
 * @author      Wes Garland, wes@kingsds.network
 * @date        July 2018
 */
const process = require('process')

require('dcp-rtlink/rtLink').link(module.paths)
require('config').load(process.argv[2], process.argv[3])

const whiteLists = {
  default: [ 'hostname', 'port', /[a-z]U[rR][lL]$/, 'openSignup' ]
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

var webConfig = {
  scheduler: safeSubset('scheduler'),
  packageManager: safeSubset('packageManager'),
  // storage: safeSubset('storage'),
  bank: safeSubset('bank'),
  portal: safeSubset('portal'),
}

require('fs').writeFileSync(dcpConfig.root + "/www/docs/etc/dcp-config.js", 'var dcpConfig = ' + JSON.stringify(webConfig), "utf-8")
