///////////////////////////////////////////////////////////////////////////////
//
//  SHA256 Hash-Loop-search
//  Author: Christopher Roy
//  Date: October 16th, 2018
//
//  Description:
//    Creates a list or chain of hashes, build off of the previous hash in the
//  list. If a hash of a hash is found previously in the list, then every hash
//  in that list from the found matching hash to the hash produced will
//  loop over.
//
//    Oversimplified Eg.  hash(7)->11, hash(11)->2, hash(2)->99, hash(99)->7, hash(7)->11
//  If closed loop is found, we want to remember it and it's length. 
//
//    Note: The astronomical scale of the possability space of SHA256 hashes
//  Means it is infinitesimaly likely that a loop will ever be found, so this
//  will likely produce nothing under a large number of attempts or a large
//  depth of search.
//    Note: If a loop is ever found the result might be famous like some
//  rare numbers with special properties, so perhaps still worth attepting.
//    Note: This 'Job' is designed to simulate 'coin mining' and jobs which
//  run on random generated data and only return results when a solution
//  (hash-loop) is found.
//    Note: The shorter the successful loop the better value
//
//  Based on the Hundred Prisoners Problem:
//  https://en.wikipedia.org/wiki/100_prisoners_problem
//
//  Based on the Birthday Problem
//  https://en.wikipedia.org/wiki/Birthday_problem
//
///////////////////////////////////////////////////////////////////////////////
const crypto = require('crypto');
let maxAttempts = 10000;
let maxDepth = 1000;

///////////////////////////////////////////////////////////////////////////////
// Support Functions
///////////////////////////////////////////////////////////////////////////////
function getNewHash(seed) {
  if(!!seed)
    return crypto.createHmac('sha256', seed).digest('hex');
  else
    return crypto.createHmac('sha256', uuid()).digest('hex');
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

///////////////////////////////////////////////////////////////////////////////
// Main search function
///////////////////////////////////////////////////////////////////////////////
function search( attemptIndex, seed ) {
  let hashes = [];
  let hash = getNewHash( seed );
  let index = 1;

  hashes.push( hash );
  while(index < maxDepth) {
    hash = getNewHash(hashes[ index - 1 ]);

    // Is loop found
    if(hashes.indexOf(hash) != -1) {
      console.log('magic hash:'+ hash, 'loop-length:'+hashes.length );
      return hashes.slice(hash, hashes.indexOf(hash), hashes.length);
    } else {
      hashes.push( hash );
    }

    index++;
  }

  // Log progress
  console.log( 'Batch#'+ attemptIndex +' of size '+ maxDepth, Math.floor((attemptIndex/maxAttempts)*100) + '%', hashes[hashes.length - 1] );
}

///////////////////////////////////////////////////////////////////////////////
// Main Loop
///////////////////////////////////////////////////////////////////////////////
for(let i=0; i<maxAttempts;i++) {
  let result = search( i )
  if( !!result ) {
    console.log('Success: ' + result);
    break
  }
}

console.log('Done.');
