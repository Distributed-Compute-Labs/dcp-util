let fs = require('fs')
let path = require('path')
let taskEx = new RegExp('/fetch/task')
let returnEx = new RegExp('/return/task')
let resultsEx = new RegExp('/submit/results')

let receiptEx = new RegExp('/receipt')

let ips = {}
let tasksFetched = 0
let tasksReturned = 0
let resultsSubmitted = 0
let receiptsRecieved = 0

let checkFile = (filename) => {
  let log = fs.readFileSync(path.resolve(__dirname, '../../production-logs/', filename), 'utf-8')
  let lines = log.split('\n')

  for (let i = 0; i < lines.length; i++) {
    let ip = lines[i].split(' ')[0]
    if (typeof ips[ip] === 'undefined') ips[ip] = { total: 0, tasksFetched: 0, tasksReturned: 0, resultsSubmitted: 0 }

    ips[ip].total++

    if (taskEx.test(lines[i])) {
      ips[ip].tasksFetched++
      tasksFetched++
    }
    if (returnEx.test(lines[i])) {
      ips[ip].tasksReturned++
      tasksReturned++
    }
    if (resultsEx.test(lines[i])) {
      ips[ip].resultsSubmitted++
      resultsSubmitted++
    }
    // if (receiptEx.test(lines[i])) receiptsRecieved++
  }
}

// checkFile('access.log')
checkFile('xaa')
checkFile('xab')
checkFile('xac')
checkFile('xad')

let results = []
let keys = Object.keys(ips)
let totalRequests = 0
for (let i = 0; i < keys.length; i++) {
  results.push([keys[i], ips[keys[i]]])
  totalRequests += ips[keys[i]].total
}

results.sort((a, b) => {
  return a[1].total - b[1].total
})

console.log(results)
console.log('Total Requests:', totalRequests)
console.log('Tasks Fetched:', tasksFetched)
console.log('Tasks Return:', tasksReturned)
console.log('Results Submitted:', resultsSubmitted)
// console.log('Reciepts Recieved:', receiptsRecieved)

process.exit(0)
