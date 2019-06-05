/** @file       worker.js               Function for dependency example
 *  @author     Matthew Palma
 *  @date       April 2018
 */

function fn(x,y) {
  return RMath.sinpi(x + y * y) * RMath.dpois(-(x*x + y*y*.5), x+y, true);
};

let results = [];
for (let x of d[0]) {
  for (let y of d[1]) {
    results.push(fn(x,y));
  }
}

return results;
