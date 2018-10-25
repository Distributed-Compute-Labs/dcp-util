/** @file	worker.js	        Function for narcnum example
 *  @author	Matthew Palma
 *  @date	Match 2018
 */

function main() { 
  let result = [];
  for (let x of d[0]) {
    for (let y of d[1]) {
      result.push(potential(x,y));
    }
  }
  return result;
}

function potential(x, y) {
  return Math.sin(x + y * y) * Math.exp(-(x*x + y*y*.5));
}

return main();