#! /usr/bin/env node
/** @file       makePackageConfig.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       January 2020
 *
 *  This script emits a dcp-default-config containing only the specified 
 *  portions of the host's dcpConfig, with an optional header.
 */

require('dcp-rtlink').init();

const options = require('yargs')
  .alias('help', 'h')
  .help(true)
  .usage('makePackageConfig.js - Generate dcp-default-config for packaged distribution.\n\
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.\n\n\
Usage: $0 [--section configKey1 configKey2...] [--header=./boilerplate.js]')
  .example('$0 --section scheduler bank.address bank.location --output=dcp-special-config.js')
  .wrap(require('yargs').terminalWidth())
  .hide('version')
  .describe('header', 'Optional path to a file to prepend to the output. Content should be valid JS.')
  .normalize('header')
  .describe('section', 'Specify one or more sections from dcpConfig to include in output')
  .array('section')
  .alias('section', 's')
  .describe('output', 'Specify a file to save the generated configuration. Default: stdout')
  .normalize('output')
  .alias('output', 'o')
  .describe('loadFrom', 'Specify a static configuration file to load from. Default: use local configuration')
  .normalize('loadFrom')
  .argv;

// --- 8< --- 8< ---

const myConfig = {};
let header = false;


// If no sections specified, assume the user doesn't know what they're doing:
if (!options.section) {
  require('yargs').showHelp();
  require('process').exit(1);
}


// Load a static configuration
if (options.loadFrom) {
  try {
    // const lf = (require('fs').readFileSync(options.loadFrom, 'utf8'));//.replace(/^.*^return/m, '');
    require('dcp/config').addConfigFile(options.loadFrom);
  }
  catch (err) {
    console.error(`Failed to load source file "${options.loadFrom}":`, err);
    require('process').exit(2);
  }
}
require('dcp/config').load();


// Load the header content
if (options.header) {
  try {
    let headerContent = require('fs').readFileSync(options.header, 'utf-8');
    
    header = headerContent;
  }
  catch (err) {
    console.error(`Failed to open header file "${options.header}":`, err.message);
    require('process').exit(3);
  }
}

// Load specified config sections
for (let s of options.section) {
  if (s.includes('.')) {
    let c = deepCopy(myConfig, dcpConfig, s);
  }
  else {
    myConfig[s] = dcpConfig[s] || null;
  }
}

// Assemble the output
let output = '';

if (header) {
  output += header + '\n';
}

output += 'return ' + JSON.stringify(myConfig, null, 2);

// Output it
if (options.output && options.output !== '-') {
  try {
    const worked = require('fs').writeFileSync(options.output, output, 'utf-8');
    console.info('Wrote site config to ' + options.output);
  }
  catch (err) {
    console.error(`Failed to write output file "${options.output}":`, err.message);
    require('process').exit(4);
  }
}
else {
  console.log(output);
}

/** Copy specified properties from src onto dest, making intermediate objects 
 *  as needed (think mkdir -p)
 *  @param      dest            Copy properties to this object
 *  @param      src             Copy props from this object
 *  @param      path            Path within tree, eg. "scheduler.location"
 *  @return     dest, with new props
 *  {
 *    scheduler: {
 *      location: { ... }
 *    }
 *  }
 */
function deepCopy(dest, src, path) {
  if (path.includes('.')) {
    const [prop, ...rest] = path.split('.');
    if (!dest[prop])
      dest[prop] = {};
    deepCopy(dest[prop], src[prop], rest.join('.'));
    return dest;
  }
  
  if (typeof dest[path] === 'object' && typeof src[path] === 'object' && src[path]) {
    Object.assign(dest[path], src[path]);
  }
  else {
    dest[path] = src.hasOwnProperty(path) ? src[path] : null;
  }
  return dest;
}
