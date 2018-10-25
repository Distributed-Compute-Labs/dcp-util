/** @file	fn.js	            Code for the narcnum example.
 *  @author	Matthew Palma
 *  @date	March 2018
 */

function isNarc(x) {
  let str = x+"";
  let sum = 0;
  let len = str.length;

  if (x < 0) {
    return false;
  }
  else {
    for (let i = 0; i < len; i++) {
      sum += Math.pow(str.charAt(i), len);
    }
  }

  return sum == x;
};

function ping(progress) {
  postMessage({
    response : 'progress',
    value     : progress
  });
};

let results = [];

for (let i = 0, count = 0; count < 25; i++) {
  if (i % 100000 == 0)
    ping(i / 9926315);
  if (isNarc(i)) {
    count++;
    results.push(i);
  }
}

return results;