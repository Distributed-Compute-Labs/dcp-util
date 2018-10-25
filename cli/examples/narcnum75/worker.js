/** @file worker.js             Code for the narcnum example.
 *  @author Matthew Palma
 *  @date March 2018
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
    data     : progress
  });
};

let results = [];

let loops = 75;
for (let n = 0; n < loops; n++) {
  for (let i = 0, count = 0; count < 25; i++) {
    if (i % 100000 == 0)
      ping(n / loops);
    if (isNarc(i)) {
      count++;
      results.push(i);
    }
  }
}

return results;