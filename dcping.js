#! /usr/bin/node
/** @file       dcping.js       DCPing uses the Compute API to send a job with a 
 *                              trivial work function and one or more points in 
 *                              the input dataset accross a distributed computer
 *                              built with DCP. It will then report on the time 
 *                              consumed to compute the job, and how many workers 
 *                              returned their slices, which can be used to assess 
 *                              the health of the system.
 *
 * @author       Duncan Mays, duncan@kingsds.network
 * @date         May 2019
 */

var dcpConfig
var debug = process.env.DEBUG && !!process.env.DEBUG.match(/\bdcping\b/)
URL.prototype.resolve = function dcping$$URL$resolve(path) {
  path = path.replace(/(^|\/)[.](\/[.])*(\/|$)/g, '/').replace(/[^/]+\/\.\.(\/|$)/g, '')  /* handle . and .. */
  return this.protocol + '//' +
    this.hostname +
    (this.port ? ':' + this.port : '') + '/' +
    (this.pathname.replace(/\/[^/]*$/,'/') + path).replace(/\/\//g,'/').replace(/^\//,'')
}

//gets the location of the program for reference purposes
let location = ''
for (let i=0; i<process.argv[1].split('/').length-1; i++) {
  location = location + '/' + process.argv[1].split('/')[i]
}
location = location.slice(1)

// rpn is a HTTP request client with promise support
const rpn = require('request-promise-native')
// needed to read keystore from file
const fs = require('fs')
// needed to take password from keystore
const pprompt = require('password-prompt')
// path to the keystore, can be configured with -i
const expandTilde = require('expand-tilde')
let keyStorePath = expandTilde('~')+'/.dcp/default.keystore'
// address of the scheduler, can be configured with the --scheduler option
let scheduler = new URL('https://scheduler.distributed.computer/')
let computeBundlePath = '/node_modules/dcp-client/dist/compute.min.js'
// number of ping jobs the program will send to scheduler
let numJobs = 3
// this is set to 1 when there is a limited number of pings the user wishes to execute, ie, when they use the -c option
// by default this program will continuosly ping the scheduler
let notContinuous = 0
// number of jobs (pings) sent to scheduler
let jobsSent = 0
// number of jobs completely returned by the scheduler
let jobsCompleted = 0
// the number of failed jobs isn't necessarily jobsSent-jobsCompleted, if SIGINT is broadcast while a job is pending, that job will neither
// complete nor fail, but will have been sent.
let jobsFailed = 0
// total number of slices sent through the duration of the program, not just during one job
let totalSlicesSent = 0
// total number of slices returned through the duration of the program, not just during one job
let totalSlicesReturned = 0
// number of slices returned during one job, not during the duration of the program
let slicesReturned = 0
// number of slices per ping job, can be configure with -s but is set to 3 by default
let numSlicesPerJob = 3
// jobs will timeout after this many seconds, can be configured with -W, but is set to 120 by defualt
let timeLimit = 120
// controls how verbose the output is, configured with -v
let verbose = false
// mode controls how the program behaves, see main at the bottom for all the modes and how they behave, can be configuresd with the -f and --interval options
let mode = 'normal'
// the interval, in seconds, that the program pings the given scheduler continuously.
let interval = 120
// amount of DCC per slice to pay
let costProfile = 0.0015

// when ctrl C is pressed, call endProgram
process.on('SIGINT', () => endProgram())

// holds the arguements given to the program from the command line
// the fisrt two elements of process.argv are the location of node and the location of DCPing by default, so we must slice them off
const args = process.argv.slice(2)

// scans over arguements adjusts variables accordingly
for (let j = 0; j < args.length; j++) {
  switch (args[j]) {
    case '--scheduler':
      // changes scheduler
      scheduler = new URL(args[j + 1])
      j++
      break
    case '-c':
      // configures the number of times the scheduler is pinged
      notContinuous = 1
      numJobs = parseInt(args[j + 1])
      j++
      break
    case '-s':
      // configures the number of slices sent to the scheduler per job
      numSlicesPerJob = parseInt(args[j + 1])
      j++
      break
    case '-W':
      // configures the timeout for each slice
      timeLimit = parseFloat(args[j + 1])
      j++
      break
    case '-v':
      // something I plan on expanding on later, gives more verbose output, right now it only lists the full job ID
      verbose = true
      break
    case '-i':
      // configures the path to the keystore
      keyStorePath = args[j + 1]
      j++
      break
    case '-f':
      mode = 'flood'
      break
    case '--interval':
      mode = 'interval'
      interval = parseFloat(args[j + 1])
      j++
      break
    case '-C':
      // configures the cost per slice
      costProfile = parseFloat(args[j + 1])
      j++
      break
    case '-h':
      // displays help message and ends the program
      Usage()
      endProgram(0)
      break;
    case '--help':
      // displays help message and ends the program
      Usage()
      endProgram(0)
      break;
    case '-?':
      // displays help message and ends the program
      Usage()
      endProgram(0)
      break;
  }
}

/** main program exit point
    displays results of pings and shows an error if any jobs did not return
 */
function endProgram (errorCode) {
  // adds a line after previous output to make output more attractive
  console.log('--------------------------------------------------------------------------------')

  console.log(jobsSent + ' jobs submitted, ' + jobsCompleted + ' jobs completed, %' + Math.round(10000 * (jobsSent - jobsCompleted) / jobsSent) / 100 + ' jobs failed')
  console.log(totalSlicesSent + ' slices submitted, ' + totalSlicesReturned + ' slices returned, %' + Math.round(10000 * (totalSlicesSent - totalSlicesReturned) / totalSlicesSent) / 100 + ' slices lost')

  // tells a parent program that an error occured if any jobs failed
  if (jobsFailed > 0) {
    errorCode = 1
  }

  process.exit(errorCode)
}

/** erases num characters from the current console line, cannot erase the line above
 */
function erase (num) {
  let backspaceCharacters = ''
  for (let i = 0; i < num; i++) {
    backspaceCharacters = backspaceCharacters + '\b'
  }
  process.stdout.write(backspaceCharacters)
}

/** Handle an error (rejection) from the rpn() "fetch" function.
 *
 *  @param      {object}        error   The rejection from rpn.  The call to rpn() /must/ use
 *                              the (default) simple module and the `resolveWithFullResponse: true`
 *                              option.
 *  @returns    {string}        An error message, formatted with ANSI color when the output
 *                              is a terminal, suitable for writing directly to stdout. If
 *                              the response included html content (eg a 404 page), it is 
 *                              rendered to text in this string.
 *  @throws     when error is not a type we can pretty-print (DNS failure, bad HTTP status, etc). 
 *              If the error was an instance of Error, we append extra information to the stack property 
 *              to include the calling location rather than bottoming out at the Promise.
 *  @see        require('request-promise-native')
 *
 *  @example    <code>
 *  try { 
 *    await rpn({uri: confHref, resolveWithFullResponse: true, simple: true}) 
 *  } catch (e) {
 *    console.log(rpnPrettyReject(e))
 *  }
 *  </code>
 */

function rpnPrettyReject(error) {
  let response, message
  const chalk = new require('chalk').constructor({enabled: require('tty').isatty(0)})

  if (error.name === 'RequestError' && error.cause.errno === 'ENOTFOUND')
    return chalk.bold('Unable to connect') + `: DNS cannot resolve '${error.error.hostname}'`
  
  if (!error.statusCode) {
    if (error instanceof Error)
      error.stack += '\n-------------------\n' + new Error().stack.split('\n').slice(2).join('\n')
    throw error
  }

  response = error.response
  message = `HTTP Status: ${response.statusCode} accessing ${response.request.href}`
  
  switch(response.headers['content-type'].replace(/;.*$/, '')) {
  case 'text/plain':
    message += '\n' + chalk.grey(response.body)
    break;
  case 'text/html':
    message += '\n' + chalk.grey(require('html-to-text').fromString(response.body, {
      wordwrap: parseInt(process.env.COLUMNS, 10) || 80,
      format: {
        heading: function (elem, fn, options) {
          var h = fn(elem.children, options);
          return '====\n' + chalk.yellow(chalk.bold(h.toUpperCase())) + '\n====';
        }
      }}))
    break;
  }
  console.log(response.headers['content-type'])
  return message
}    

/** loads the compute and protocol modules of DCP into the namespace
 */
async function loadCompute () {
  let confHref = scheduler.resolve('/etc/dcp-config.js')
  if (debug)
    console.log(` * Fetching ${confHref}`)
                
  try {
    let response = await rpn({uri: confHref, resolveWithFullResponse: true, simple: true})
    let sandbox = { window: global, URL: URL }
    dcpConfig = require('vm').runInNewContext(response.body, sandbox, {filename: confHref, lineOffset: 0})
  } catch (error) {
    console.log(rpnPrettyReject(error))
    process.exit(1)
  }

  // Note: Don't do const compute = require(...), since the file already
  // injects compute and protocol into the global namespace. :(
  if (process.env.DCPING_LOCAL_BUNDLE) {
    let computeBundleFilename = process.env.DCPING_LOCAL_BUNDLE
    if (debug)
      console.log(` * Loading ${computeBundleFilename}`)
    eval(require('fs').readFileSync(computeBundleFilename, 'utf-8'))
  } else {
    let computeHref = dcpConfig.portal.location.href.replace(/\/$/,'') + '/' + computeBundlePath.replace(/^\//,'')
    if (debug)
      console.log(` * Fetching ${computeHref}`)
    try {
      let response = await rpn({uri: computeHref, resolveWithFullResponse: true, simple: true})
      eval(response.body)
    } catch(e) {
      console.log(rpnPrettyReject(e))
      process.exit(1)
    }
  }
  
  // Load the keystore:
  const keystore = JSON.parse(fs.readFileSync(keyStorePath, 'ascii'))
<<<<<<< HEAD
  const keystorePassword = await pprompt("Enter keystore password:", {method: 'hide'})
  
=======
  const keystorePassword = await pprompt("Enter keystore password:", {method: 'hide', required: false })

>>>>>>> origin/master
  protocol.keychain.addKeystore(keystore, keystorePassword, true)
}

/** called when a job is accepted by the scheduler
 */
function onAccepted (jobID) {
  jobsSent++
  totalSlicesSent += numSlicesPerJob
  if (verbose) {
    console.log('Job accepted, ID: ' + jobID)
  } else {
    // if not verbose, only display the first 20 digits of the job ID, we're slicing 22 off since the first two digits are 0x
    console.log('Job accepted, ID: ' + jobID.slice(0, 22))
  }

  updateSliceCount()
}

/** called when a slice is returned by the scheduler
 */
function onResult () {
  if (this.cancelled) { return } // DCP-563

  slicesReturned++
  totalSlicesReturned++

  updateSliceCount()
}

/** called when all the slices from a job are returned
 */
function onJobComplete () {
  jobsCompleted++
}

/** body of the program, does the actual pinging and interaction with compute API
 */
async function ping (numSlices) {
  // this is the array that will be distributed on the network
  let input = []
  for (let i = 1; i < numSlices + 1; i++) {
    input.push(i)
  }

  // sets up the job
  const job = compute.for([input], trivialWork)
  var resultFn = onResult.bind(job)
  job.on('accepted', () => onAccepted(job.id))
  job.on('result', resultFn)
  job.on('complete', () => onJobComplete())

  job._generator.public = {
    name: 'DCPing'
  }

  // resets number of slices returned
  slicesReturned = 0
  // starts timer for how long the job takes
  const startTime = eval(new Date()).getTime()

  try {
    await new Promise((resolve, reject) => {
      job.exec(costProfile * numSlices).then((ev) => resolve(ev), (ev) => reject('error in job creation ' + ev))

      setTimeout(async () => {
        // dm may 2019 - DCP-564 job.removeEventHandler('result', resultFn);
        job.cancelled = true
        await job.cancel()
        jobsFailed++
        reject(' : job timed out')
      }, timeLimit * 1000)
    })
  } catch (error) {
    process.stdout.write(error)
  }

  // ends timer and displays result
  if (mode !== 'flood') {
    const endTime = eval(new Date()).getTime()
    const timeForJobCompletion = endTime - startTime
    console.log(' : Time for completion = ' + timeForJobCompletion + 'ms')
  }
}

/** simply returns the number given to it to test that the worker is working, connected to the network and functioning
 *  @param input    the number to return
 *  @returns input
 */
function trivialWork (input) {
  progress(1)
  return input
}

/** Information on slices thathave been sent and received are displayed with this function
 */
function updateSliceCount () {
  // only updates the slice count if mode isnt flood
  if (mode !== 'flood') {
    // effectively erases the line
    erase(150)
    // logs the number of slices that have been returned
    process.stdout.write(numSlicesPerJob + ' slices sent : ' + slicesReturned + ' slices returned')
  }
}

/** logs the help page
 */
function Usage () {
  const name = process.argv[1].split('\\').pop().split('/').pop()

  console.log(`
${name} - send a job with an arbitrary work function accross a distributed computer that uses DCP. By the number of slices that return, and how fast they return, the health of the network can be assessed.

Usage:    ${name} -c stop sending jobs after a certain number of jobs have been sent, by default DCPing sends jobs until ctrl c is pressed

          ${name} -C configure the amount of DCC being bid per slice, default is 0.0005

          ${name} -i give the file path to the keystore to be used, default is ~/.dcp/default.keystore

          ${name} -f send as many jobs to the scheduler as possible and do not track returned slices, be careful as this option burns through DCC

          ${name} --interval configure DCPing to send a job to the scheduler every interval of a certain length, by default DCPing send the next job when the current job either completes or times out, units are seconds

          ${name} -W set DCPing to cancel jobs if they haven't returned after a certain amount of time, you cannot configure DCPing to timout jobs after a longer amount of time than configured using --interval, units are seconds and the defualt is 120

          ${name} -s configure the number of slices DCPing send to the scheduler per job, the default is 3 slices

          ${name} --scheduler configure the URL of the scheduler, default is ${scheduler}

          ${name} -h display this help message

NOTE TO THE USER
This is by no means a complete utility, certain libraries are missing that would otherwise have been used here, namely some API for keystore access, and a safeMarketValue function, where the market value of a slice is received from the scheduler and used as the cost per slice.
  `)
}

/** main program entry point
 */
async function main () {
  // loads compute
  await loadCompute()
  console.log('DCPing scheduler: ' + scheduler)

  switch (mode) {
    case 'normal':
      // pings the given scheduler the given number of times, one at a time
      for (let i = numJobs; i > 0; i -= notContinuous) {
        await ping(numSlicesPerJob)
      }

      endProgram(0)
      break
    case 'flood':
      // floods the schedulers with as many jobs as possible
      await setInterval(() => ping(numSlicesPerJob), 300)
      break
    case 'interval':
      // checks and corrects for interval < timeLimit, which would cause unwanted behavior
      if (interval < timeLimit) {
        console.log()
        console.log('pings must timeout before the next one is sent, pings will timeout after ' + interval + ' seconds')
        timeLimit = interval
        console.log()
      }

      // pings the scheduler every interval of a given length
      ping(numSlicesPerJob)
      await setInterval(() => ping(numSlicesPerJob), interval * 1000)
      break
  }
}

main()
