const express = require('express');
const app     = express();
const server  = require('http').Server(app);

// This can be a rule in nginx.conf
app.use(express.static('examples'));
app.use(express.static('src'));
app.use(express.static('utilities'));
app.use(express.static('node_modules'));

// CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// this stuff should be moved to a util file somewhere
var getBody = function(stream) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", e => reject(e));
  });
}

const version = "0.0.3";
const logger = require('../src/node/logger.js');
      logger.createLog("DCP BOARD VERSION " + version + "\n", "board");

// for debugging unhandled promises
process.on('unhandledRejection', (reason, p) => {
   console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
   logger.log('Unhandled Rejection at: Promise ' + JSON.stringify(p), 'reason: ' + JSON.stringify(reason));
});

// Body parser
app.use((req, res, next) => {
  logger.log([
    'HTTP',
    req.httpVersion,
    req.method,
    req.url,
    '\n'
  ].join(" "));

  getBody(req)
  .then(body => {
    body = body.toString();

    try {
      body = JSON.parse(body);
    } catch(e){}

    req.body = body;
    next();
  })
  .catch(error => console.log("request body could not be parsed", error));
});

/**
 * Command line options
 *
 * npm start arg1 arg2=val2 arg3 ..
 *
 * EG: npm start dev port=3000
 */

var options = {
    mine : false
};

for (let i = 0; i < process.argv.length; i++) {
  let values = process.argv[i].split('=');
  if (values[0] === 'mine')       options.mine  = true;
  else if (values[0] === 'board') options.board = true;
  else if (values[0] === 'bank')  options.bank  = true;
}

app.get('/status', function(req,res){
  res.status(200).end();
});

// if(options.board){
  const board = require("../src/node/board.js");
  const io = board.init(app, {}, server);
// }

// if(options.bank){
  const bank = require("../src/node/bank.js");
        bank.init(app, {}, server);
// }

// if(options.mine){
//   const miner = require('./src/node/miner.js');
//         miner.open('v8/v8.exe', function(message){
//           message = JSON.parse(message);
//           console.log('from c:', message);
//           if(message.request === "ready"){
//             console.log('running task:');
//             miner.run({
//               request : 'main',
//               limit : 100000
//             });
//           }
//         });
// }

server.listen(3000);

console.log('DCP server running');

// http://glynnbird.tumblr.com/post/54739664725/graceful-server-shutdown-with-nodejs-and-express
let gracefulShutdown = function() {
  io.close(
    function() {
      io.destroy();
      server.close(function() {
        process.exit();
      });
    }
  );

  setTimeout(function() {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit();
  }, 5*1000);
}

// listen for TERM signal .e.g. kill
process.on ('SIGTERM', gracefulShutdown);

// listen for INT signal e.g. Ctrl-C
process.on ('SIGINT', gracefulShutdown);

module.exports = {
  app,
  server
};
