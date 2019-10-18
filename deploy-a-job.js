/**
 * @file    deploy-a-job.js
 *          Creates a job that executes a function and deploys it after
 *          dcp-minimal-env is loaded in a node environment.
 *          One of the jobs emits indeterminate progress updates.
 * @author  Christopher Roy
 * @date    August 2019
 */

function primes_bruteforce (input, step = 10000) {
  function isPrime (n) {
    for (let i = 2; i <= (n / 2); i++) {
      if ((n / i) == Math.floor(n / i)) { return false }
    }
    return true
  }

  var primes = []

  progress(0)

  for (let i = input; i < input + step; i++) {
    if (isPrime(i)) { primes.push(i) }
  }

  return progress(1) && {
    primes,
    primeNumberOfPrimes: isPrime(primes.length)
  }
}

function lucasPrimes (start, step) {
  function isPrime (n) {
    for (let i = 2; i <= (n / 2); i++) {
      if ((n / i) === Math.floor(n / i)) { return false }
    }
    return true
  }
  function nextLucas (a = 2, b = 1) {
    return a + b
  }
  function isLucas (n) {
    let a = 2
    let b = 1
    let c = nextLucas(a, b)
    if ([2, 1].indexOf(n) !== -1) return true

    while (c <= n) {
      if (c === n) return true
      if (c > n) return false
      a = b
      b = c
      c = nextLucas(a, b)
    }
  }

  const hits = []

  for (let i = start; i < start + step; i++) {
    if (isPrime(i) && isLucas(i)) hits.push(i)
  }

  return {
    hits
  }
}

function erastothenes (min, step = 10000) {
  const range = [null, true]
  const primes = []
  const max = min + step

  progress(0)

  for (let i = 2; i < max; i++) {
    if (isPrime(i)) {
      continue
    }
    range[i] = range[i] || true

    for (let j = i; j < max; j += i) {
      range[j] = range[j] || i
    }
  }
  // console.log(range)

  function isPrime (n) {
    return range[n] === true
  }

  for (let i = min; i < max; i++) { if (isPrime(i)) primes.push(i) }

  return progress(1) && {
    primes,
    primeNumberOfPrimes: isPrime(primes.length)
  }
}

function perfectNumbers (min, step = 10000) {
  const perfects = []
  const max = min + step

  function factors (n) {
    const f = [1]
    for (let i = 2; i <= n / 2; i++) {
      if ((n / i) === Math.floor(n / i)) {
        if (f.indexOf(i) === -1) f.push(i)
        if (f.indexOf(n / i) === -1) f.push(n / i)
      }
    }
    f.sort((a, b) => (a - b))
    return f
  }

  function isPerfect (n) {
    if (n === 1) return false

    const f = factors(n)
    const sum = f.reduce((ax, cx) => {
      ax += cx
      return ax
    }, 0)
    // console.log(n, sum, sum === n, f)
    return sum === n
  }

  for (let i = min; i < max; i++) {
    if (isPerfect(i)) {
      perfects.push(i)
    }
    const prg = ((i - min) / (max - min)) * 100
    if ((Math.floor(prg) === prg) && (prg % 10) === 0) { progress(prg / 100) }
  }

  return progress(1) && {
    perfects
  }
}

function perfectNumbersWithIndeterminateProgress (min, step = 10000) {
  const perfects = []
  const max = min + step

  progress(0.10)

  function factors (n) {
    const f = [1]
    for (let i = 2; i <= n / 2; i++) {
      if ((n / i) === Math.floor(n / i)) {
        if (f.indexOf(i) === -1) f.push(i)
        if (f.indexOf(n / i) === -1) f.push(n / i)
      }
    }
    f.sort((a, b) => (a - b))
    return f
  }

  function isPerfect (n) {
    if (n === 1) return false

    const f = factors(n)
    const sum = f.reduce((ax, cx) => {
      ax += cx
      return ax
    }, 0)
    // console.log(n, sum, sum === n, f)
    return sum === n
  }

  for (let i = min; i < max; i++) {
    if (isPerfect(i)) {
      perfects.push(i)
    }
    const prg = ((i - min) / (max - min)) * 100
    if ((Math.floor(prg) === prg) && (prg % 10) === 0) {
      progress('indeterminate')
    }
  }

  return progress(1) && {
    perfects
  }
}

function productOfPrimes (start, len = 10000) {
  function isPrime (n) {
    for (let i = 2; i <= (n / 2); i++) {
      if ((n / i) === Math.floor(n / i)) { return false }
    }
    return true
  }

  function factors (n) {
    const f = []
    for (let i = 2; i < (n / 2); i++) {
      if ((n / i) === Math.floor(n / i)) {
        f.push(i, (n / i))
      }
    }
    if ((n % 2) === 0 && !f.includes(n / 2)) {
      f.push(n / 2)
    }
    f.sort()
    return f
  }

  function isPOP (n) {
    const f = factors(n)
    return !isPrime(n) && f.every(isPrime)
  }

  progress(0)
  const pops = []
  const span = Math.round(len / 100)

  for (let n = start; n < start + len; n++) {
    const prg = (n - start) / span
    if (prg === Math.floor(prg) && (prg % 10) === 0) {
      progress((n - start) / len)
    }
    if (isPOP(n)) {
      pops.push(n)
    }
  }

  return progress(1) && pops
}

// ro = new RangeObject(0, 1999999, 5000)
const ro = new RangeObject({ start: 2e6, end: 3e6, step: 3000, group: 1 })
console.log('New rangeobject ro =', ro)

// g = compute.for(ro, primes_bruteforce, [ro.step]); g._generator.public = { name: 'Bruteforce Primes ' + ro.step }
// g = compute.for(ro, erastothenes, [ro.step]); g._generator.public = { name: 'Sieve of Erastothenes ' + ro.step }
// g = compute.for(ro, perfectNumbers, [ro.step]); g._generator.public = { name: 'Perfect Numbers ' + ro.step }
g = compute.for(ro, perfectNumbersWithIndeterminateProgress, [ro.step]); g._generator.public = { name: 'Perfect Numbers ' + ro.step }
// g = compute.for(ro, lucasPrimes, [ro.step]); g._generator.public = { name: 'Lucas Primes ' + ro.step }
// g = compute.for(ro, productOfPrimes, [ro.step]); g._generator.public = { name: 'Product of Primes ' + ro.step }

g.on('accepted', () => console.log('Generator accepted', g.id))
// g.on('result', r => console.log('Got result', r.sliceNumber, r.result))
g.on('duplicate-result', r => console.log('Got dupe for slice number', r.sliceNumber, r.changed))
g.on('complete', () => console.log('Complete!'))

// only for perfectNumbers()!
// g.on('result', ev => {
//   if (!ev.result.perfects.length) return
//   console.log(`Slice ${ev.sliceNumber}: Found match`, ev.result.perfects)
// })

g.setPaymentAccount(paymentWallet)

console.log('Worker is ready on global variable g')

g.exec(0.01 * ro.length)
