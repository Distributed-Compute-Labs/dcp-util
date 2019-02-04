let fs = require('fs')
// let taskEx = new RegExp('/fetch/task')
// let returnEx = new RegExp('/return/task')
// let resultsEx = new RegExp('/submit/results')

let recieptEx = new RegExp('/reciept')

let ips = {}
let tasksFetched = 0
let tasksReturned = 0
let resultsSubmitted = 0
let recieptsRecieved = 0

let checkFile = (filename) => {
  let log = fs.readFileSync('../../production-logs/' + filename, 'utf-8')
  let lines = log.split('\n')

  for (let i = 0; i < lines.length; i++) {
    let ip = lines[i].split(' ')[0]
    if (typeof ips[ip] === 'undefined') ips[ip] = 1
    else ips[ip]++

    // if (taskEx.test(lines[i])) tasksFetched++
    // if (returnEx.test(lines[i])) tasksReturned++
    // if (resultsEx.test(lines[i])) resultsSubmitted++
    if (recieptEx.test(lines[i])) recieptsRecieved++
  }
}

checkFile('access.log')
// checkFile('xaa')
// checkFile('xab')
// checkFile('xac')
// checkFile('xad')
// checkFile('xae')
// checkFile('xaf')
// checkFile('xag')
// checkFile('xah')
// checkFile('xai')
// checkFile('xaj')
// checkFile('xak')

let results = []
let keys = Object.keys(ips)
let totalRequests = 0
for (let i = 0; i < keys.length; i++) {
  results.push([keys[i], ips[keys[i]]])
  totalRequests += ips[keys[i]]
}

results.sort((a, b) => {
  return b[1] - a[1]
})

// console.log(results)
console.log('Total Requests:', totalRequests)
// console.log('Tasks Fetched:', tasksFetched)
// console.log('Tasks Return:', tasksReturned)
// console.log('Results Submitted:', resultsSubmitted)
console.log('Reciepts Recieved:', recieptsRecieved)

process.exit(0)
