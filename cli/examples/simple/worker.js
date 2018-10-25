/** @file	worker.js	        Job for prime number example
 *  @author	Christopher Roy
 *  @date	Feb 2018
 */

function isEven(x) {
  return x % 2 == 0;
}

module.declare((require, exports, module) => {
  addEventListener("message", (event) => {
    if (event.data.request === 'main') {
      let message = event.data;
      let results = [];

      for (let i = 1; i <= message.data[message.end]; i++) {
        let result = isEven(message.data[i])
        results.push(result);

        postMessage({
          request: 'progress',
          value: i / message.data[message.start].length
        })
      }

      // Complete
      postMessage({
        request : 'complete',
        result : results
      });
    }
  });
});
