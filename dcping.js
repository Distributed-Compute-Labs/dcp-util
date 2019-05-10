#! /usr/bin/node

/*
Written by Duncan Mays in May of 2019

DCPing uses the Compute API to send a job with a trivial work function and one or more points in the input dataset accross a distributed computer
built with DCP. It will then report on the time consumed to compute the job, and how many workers returned their slices, which can be used to 
assess the health of the system.

All functions are in alphabetical order, except main which is down at the bottom.
*/

//number of slices per diagnostic job
let numSlices = 3;
//rpn is a HTTP request client with promise support
const rpn = require('request-promise-native');
//needed to read keystore from file
const fs = require('fs');
//needed to take password from keystore
const pprompt = require('password-prompt');
//path to the keystore, can be configured with -i
let keyStorePath = 'myDCPKey.keystore';
//address of the scheduler, can be configured with the --scheduler option
let scheduler = "https://portal.distributed.computer/etc/dcp-config.js";
//number of ping jobs the program will send to scheduler
let numJobs=3
//this is set to 1 when there is a limited number of pings the user wishes to execute, ie, when they use the -c option
//by default this program will continuosly ping the scheduler
let notContinuous = 0
//number of jobs (pings) sent to scheduler
let jobsSent=0
//number of jobs completely returned by the scheduler
let jobsCompleted=0
//the number of failed jobs isn't necessarily jobsSent-jobsCompleted, if SIGINT is broadcast while a job is pending, that job will neither
//complete nor fail, but will have been sent.
let jobsFailed=0
//total number of slices sent through the duration of the program, not just during one job
let totalSlicesSent=0
//total number of slices returned through the duration of the program, not just during one job
let totalSlicesReturned=0
//number of slices returned during one job, not during the duration of the program
let slicesReturned=0
//number of slices per ping job, can be configure with -s but is set to 3 by default
let numSlicesPerJob=3
//jobs will timeout after this many seconds, can be configured with -W, but is set to 120 by defualt
let timeLimit=120;
//controls how verbose the output is, configured with -v
let verbose = false;
//mode controls how the program behaves, see main at the bottom for all the modes and how they behave, can be configuresd with the -f and --interval options
let mode = 'normal';
//the interval, in seconds, that the program pings the given scheduler continuously.
let interval = 120;
//amount of DCC per slice to pay
let costProfile = 0.0005;

//when ctrl C is pressed, call endProgram
process.on('SIGINT', () => endProgram());

//holds the arguements given to the program from the command line
//the fisrt two elements of process.argv are the location of node and the location of DCPing by default, which are not useful to this program
const args = process.argv.slice(2);

//scans over arguements adjusts variables accordingly
let arguement = '';
for(let j=0; j<args.length; j++){
  switch(args[j]){
    case '--scheduler':
      //changes scheduler
      scheduler = args[j+1];
      j++;
      break;
    case '-c':
      notContinuous = 1;
      numJobs = parseInt(args[j+1]);
      j++
      break;
    case '-s':
      numSlicesPerJob = parseInt(args[j+1]);
      j++
      break;
    case '-W':
      timeLimit = parseFloat(args[j+1]);
      j++
      break;
    case '-v':
      verbose = true;
      break;
    case '-i':
      keyStorePath = args[j+1];
      j++
      break;
    case '-f':
      mode = 'flood';
      break;
    case '--interval':
      mode = 'interval';
      interval = parseFloat(args[j+1]);
      j++;
      break;
    case '-C':
      costProfile = parseFloat(args[j+1]);
      j++;
      break;
  }
}

/** main program exit point
    displays results of pings and shows an error if any jobs did not return
 */
function endProgram(errorCode){
  //adds a line after previose output to make output more attractive
  console.log('----------------------------------------------------------------------');

  console.log(jobsSent+' jobs submitted, '+jobsCompleted+' jobs completed, %'+Math.round(10000*(jobsSent-jobsCompleted)/jobsSent)/100+' jobs failed');
  console.log(totalSlicesSent+' slices submitted, '+totalSlicesReturned+' slices returned, %'+Math.round(10000*(totalSlicesSent-totalSlicesReturned)/totalSlicesSent)/100+' slices lost');

  //tells a parent program that an error occured if any jobs failed
  if(jobsFailed > 0){
    errorCode = 1;
  }

  process.exit(errorCode);
}

/**erases num characters from the current console line, cannot erase the line above
 */
function erase(num){
  let backspaceCharacters = '';
  for(let i=0; i<num; i++){
    backspaceCharacters = backspaceCharacters + '\b';
  }
  process.stdout.write(backspaceCharacters);
}

/**loads the compute and protocol modules of DCP into the namespace
 */
async function loadCompute() {
  try{
    eval(await rpn(scheduler));
  } catch(error){
    console.log('there was a problem connecting to the scheduler')
    console.log(error);
    endProgram(1);
  }

  global.dcpConfig = dcpConfig;
  // Note: Don't do const compute = require(...), since the file already
  // injects compute and protocol into the global namespace.
  require('/var/dcp/node_modules/dcp-client/dist/compute.min.js');
  // Load the keystore:
  const keystore = JSON.parse(fs.readFileSync(keyStorePath, 'ascii'));
  const keystorePassword = await pprompt("Enter keystore password:", {method: 'hide'});
  protocol.keychain.addKeystore(keystore, keystorePassword, true);
}

/**called when a job is accepted by the scheduler
 */
function onAccepted(jobID){
  jobsSent++;
  totalSlicesSent += numSlicesPerJob;
  if(verbose){
    console.log('Job accepted, ID: ' + jobID);
  } else {
    //if not verbose, only display the first 20 digits of the job ID, we're slicing 22 off since the first two digits are 0x
    console.log('Job accepted, ID: ' + jobID.slice(0, 22));
  }
  
  
  updateSliceCount();
}

/**called when a slice is returned by the scheduler
 */
function onResult(){
  if (this.cancelled)
    return; // DCP-XXXX 

  slicesReturned++;
  totalSlicesReturned++;
  
  updateSliceCount();
}

/**called when all the slices from a job are returned
 */
function onJobComplete(){
  jobsCompleted++;
}

/** body of the program, does the actual pinging and interaction with compute API 
 */
async function ping(numSlices){

	//this is the array that will be distributed on the network
	let input = []
	for(let i=1; i<numSlices+1; i++){
		input.push(i);
	}

  //sets up the job
	const job = compute.for([input], trivialWork);
  var resultFn = onResult.bind(job);
  job.on('accepted', () => onAccepted(job.id));
	job.on('result', resultFn);
	job.on('complete', () => onJobComplete())

  //resets number of slices returned
  slicesReturned = 0;
  //starts timer for how long the job takes
  const startTime = eval(new Date).getTime();

  try{
    const results = await new Promise((resolve, reject) => {

      job.exec(costProfile*numSlices).then((ev) => resolve(ev), (ev) => reject('error in job creation '+ev));

      setTimeout(async () => {
        //dm may 2019 - DCP-XXX job.removeEventHandler('result', resultFn);
        job.cancelled = true;
        await job.cancel();
        jobsFailed++;
        reject(' : job timed out')
      }, timeLimit*1000);
    
    });
  } catch(error){
    process.stdout.write(error);
  }

  //ends timer and displays result
  if(mode !== 'flood'){
    const endTime = eval(new Date).getTime();
    const timeForJobCompletion = endTime - startTime;
    console.log(' : Time for completion = '+timeForJobCompletion+'ms');
  }

}

/**Information on slices thathave been sent and recieved are displayed with this function
 */
function updateSliceCount(){
  //only updates the slice count if mode isnt flood
  if(mode !== 'flood'){
    //effectively erases the line
    erase(150)
    //logs the number of slices that have been returned
    process.stdout.write(numSlicesPerJob+' slices sent : '+slicesReturned+' slices returned');
  }
}

/** simply returns the number given to it to test that the worker is working, connected to the network and functioning
 *  @param input    the number to return
 *  @returns input
 */
function trivialWork(input){
  progress(1);
	return input;
}

/** main program entry point
 */
async function main(){
  //loads compute
  await loadCompute();
  console.log('DCPing scheduler: '+scheduler);

  switch(mode){
    case 'normal':
      //pings the given scheduler the given number of times, one at a time
      for(let i=numJobs; i>0; i-=notContinuous){
        await ping(numSlicesPerJob);
      }

      endProgram(0);
      break;
    case 'flood':
      //floods the schedulers with as many jobs as possible
      await setInterval(() => ping(numSlicesPerJob), 300)
    case 'interval':
      //checks and corrects for interval < timeLimit, which would cause unwanted behavior
      if(interval < timeLimit){
        console.log();
        console.log('pings must timeout before the next one is sent, pings will timeout after '+interval+ ' seconds');
        timeLimit = interval;
        console.log();

      }

      //pings the scheduler every interval of a given length
      ping(numSlicesPerJob)
      await setInterval(() => ping(numSlicesPerJob), interval*1000)
  }
}

main();