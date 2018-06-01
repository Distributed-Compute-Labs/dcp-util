const express = require('express');

const app     = express();
const server  = require('http').Server(app);

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

const version = "0.0.1";
const logger = require('../src/node/logger.js');
      logger.createLog("DCP STORAGE VERSION " + version + "\n", "storage");

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
    req.body = body.toString();
    next();
  });
  .catch(error => console.log("request body could not be parsed", error));
});

/**
 * Command line options
 *
 * npm start arg1 arg2=val2 arg3 ..
 *
 * EG: npm start dev port=3000
 */

// var options = {
//     mine : false
// };
//
// for (let i = 0; i < process.argv.length; i++) {
//   let values = process.argv[i].split('=');
//   if (values[0] === 'mine')       options.mine  = true;
// }

app.get('/status', function(req,res){
  res.status(200).end();
});

const storage = require("../src/node/storage.js");
      storage.init(app, {}, server);

server.listen(3000);

console.log('DCP Storage running');

// http://glynnbird.tumblr.com/post/54739664725/graceful-server-shutdown-with-nodejs-and-express
let gracefulShutdown = function() {
  server.close(function() {
    process.exit()
  });

  setTimeout(function() {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit()
  }, 10*1000);
}

// listen for TERM signal .e.g. kill
process.on ('SIGTERM', gracefulShutdown);

// listen for INT signal e.g. Ctrl-C
process.on ('SIGINT', gracefulShutdown);

module.exports = {
  app,
  server
};
