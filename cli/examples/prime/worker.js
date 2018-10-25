/** @file	worker.js	        Job for prime number example
 *  @author	Matt Palma
 *  @date	Feb 2018
 */

function numPrimes(x) {
  var numPrimes = 0;
  for (var counter = 0; counter <= x; counter++) {

    var isPrime = true;
    for (var i = 2; i <= counter; i++) {
      if (counter % i === 0 && i !== counter)
        isPrime = false;
    }

    if (isPrime)
      numPrimes++;
  }
  return numPrimes;
}

module.declare((require, exports, module) => {
  addEventListener("message", (event) => {
    if (event.data.request === 'main') {
      let message = event.data;
      let results = [];
      for (let x = 1; x <= message.data[message.start]; x++) {
        results.push(numPrimes(x));
        console.log(results)
        postMessage({
          request: 'progress',
          value: x / message.data[message.start]
        })
      }
      postMessage({
        request : 'complete',
        result : results
      });
    }
  });
});

console.log('hello')