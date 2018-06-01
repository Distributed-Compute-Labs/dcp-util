const express  = require('express');
const app      = express();
const server   = require('http').Server(app);

const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const { URL }  = require('url');

const md5 = require('md5');

const protocol = require("../src/node/protocol-node.js");
const database = require("../src/node/database.js");

const version = "0.0.1";
const logger = require('../src/node/logger.js');
      logger.createLog("DCP MODULES VERSION " + version + "\n", "modules");

const modulesLocation = "modules/";

var debug = true;
var config = {
  listen_port:	process.env.DCPMS_LISTEN_PORT || "9001",
  listen_host:  process.env.DCPMS_LISTEN_HOST || "127.0.0.1",
};

// these are only to make testing simple
app.use(express.static('src'));
app.use(express.static('utilities'));

app.use((req, res, next) => {
  logger.log([
    'HTTP',
    req.httpVersion,
    req.method,
    req.url,
    '\n'
  ].join(" "));

  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  next();
});

var getBody = function(stream) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", e => reject(e));
  });
}

app.post('*', (request, result, next) => {
  if (debug)
    console.log("Processing request " + request.url + " in debug mode.");

  getBody(request)
  .then(body => {
    request.body = JSON.parse(body.toString());

    if(!protocol.validate(request.body)){
      result.sendStatus(500);
    }

    next();
  })
  .catch(error => console.log("request body could not be parsed", error));
});

app.post('/fetch/module', (request, result, next) => {
  try{
    let modulePathsList = request.body.message.module;
    console.log('Got Request For: ', modulePathsList);

    let packagesWithFilesToLoad = {};
    let loadedPackages = {};
    for(let i = 0; i < modulePathsList.length; i++){
      let path = modulePathsList[i].split('/');
      let packageName = path.shift();

      if(typeof packagesWithFilesToLoad[packageName] === 'undefined'){
        packagesWithFilesToLoad[packageName] = {};
      }

      packagesWithFilesToLoad[packageName][path] = false;
    }

    let packageDescriptors = {};
    let getDescriptor = function(){
      let remainingPackages = Object.keys(packagesWithFilesToLoad);
      if(remainingPackages.length === 0){
        if(debug) console.log("Complete");
        result.json(loadedPackages);
        result.end();
        return;
      }

      let packageName = remainingPackages[0];
      let filePath = Object.keys(packagesWithFilesToLoad[packageName])[0];
      if(debug) console.log("Getting Descriptor", packageName);
      if(typeof packageDescriptors[packageName] === "undefined"){
        database.read(modulesLocation + packageName + '/package.dcp', false).then(signedFile => {
          let packageDCP = signedFile.message;
          let versions = Object.keys(packageDCP.versions);
          packageDCP.latestVersion = versions.sort()[0];

          packageDescriptors[packageName] = packageDCP;

          getFile(packageName, filePath);
        });
      }else{
        getFile(packageName, filePath);
      }
    }

    let getFile = function(packageName, filePath){
      // let packageName = remainingPackages[0];
      // let filePath = ;
      let packageDCP = packageDescriptors[packageName];
      let moduleLocation = modulesLocation + packageName + '/' + packageDCP.latestVersion + '/' + filePath;
      if(debug) console.log("Getting File", packageName, filePath, moduleLocation);
      let extensionsToTry = ['', '.js', '.ts'];
      for(let i = 0; i < extensionsToTry.length; i++){
        if(packageDCP.versions[packageDCP.latestVersion].files.hasOwnProperty(filePath + extensionsToTry[i])){
          moduleLocation += extensionsToTry[i];
          break;
        }

        if(i === extensionsToTry.length - 1){
          throw new Error("Package " + packageName + " version " + packageDCP.latestVersion + " does not contain file " + filePath);
        }
      }

      return database.read(moduleLocation, false, false).then(moduleString => {
        let posS, posE;
        /* Determine and load any dependencies for this module.
         *
         * The easy/accurate way to do this is to eval the module and extract the deps
         * when module.declare runs, but this would violate the security boundary.
         * Instead, we use an adhoc parser that is probably good enough.  If it isn't,
         * the module environment should be able to make a second dependency request
         * and recover.
         *
         * As the product matures this should maybe be migrated to a JS parser like
         * Acorn to be properly rigorous. For now, we assume no slight of hand and
         * valid module names.
         */

        /* Remove comments */
        let moduleLines = moduleString.toString().split("\n");
        for (let i = 0; i < moduleLines.length; i++){
          posS = moduleLines[i].indexOf("/*");
          if (posS == -1){
            posS = moduleLines[i].indexOf("//");	/* C++-style */
            if (posS != -1)
              moduleLines[i] = moduleLines[i].slice(0, posS);
            continue;
          }

          posE = moduleLines[i].indexOf("*/");
          if (posE != -1){
            /* single-line C-style comment */
            moduleLines[i] = moduleLines[i].slice(0, posS) + moduleLines[i].slice(posE+2);
            i--;
            continue;
          }
          /* multi-line C-style comment */
          moduleLines[i] = moduleLines[i].slice(0, posS);
          for (posE=-1; posE === -1 && i < moduleLines.length; i++){
            posE = moduleLines[i].indexOf("*/");
            if (posE != -1){
              /* end of multi-line comment */
              moduleLines[i] = moduleLines[i].slice(posE+2);
              i--;
              continue;
            }
            moduleLines[i]="";
          }
          i--;
        }

        if(typeof loadedPackages[packageName] === "undefined") loadedPackages[packageName] = {};

        moduleLines.push(";");
        if (debug)
          loadedPackages[packageName][filePath] = moduleString.toString();
        else
          loadedPackages[packageName][filePath] = moduleLines.join("\n");

        delete packagesWithFilesToLoad[packageName][filePath];
        if(Object.keys(packagesWithFilesToLoad[packageName]).length === 0) delete packagesWithFilesToLoad[packageName];

        /* Look for first occurrence of module.declare */
        for (let posS = -1, posE = -1, i = 0; i < moduleLines.length && (posS === -1 || posE !== -1); i++){
          if (posS === -1){
            posS = moduleLines[i].search(/module\s*\.\s*declare/);
            if (posS !== -1){
              depList = moduleLines[i].slice(posS);
              depList = depList.slice(depList.match(/module\s*\.\s*declare/)[0].length);
            }
          }else{
            posE = moduleLines[i].indexOf("]");
            if (posE === -1)
              depList += moduleLines[i];
            else
              depList += moduleLines[i].slice(0,posE-1);
          }
        }

        if (depList.match(/^\s*[\(\)]\s*function/)) /* no deps listed */
          return getDescriptor(); // continue with next file

        posS = depList.indexOf("[");
        if (posS !== -1){
          posE    = depList.indexOf("]");
          depList = depList.slice(0, posE - 1);
          depList = depList.slice(posS + 1).replace(/[" '"]/g,"").split(',');
          depList = depList.filter((element, position) => {
            return depList.indexOf(element) === position;
          });

          if(debug) console.log("Got Dependencies ", depList);
          for (i = 0; i < depList.length; i++){
            let dependencyPackage = packageName;
            let dependencyPath = depList[i];
            if (dependencyPath.indexOf("./") === 0 || dependencyPath.indexOf("../") === 0){
              dependencyPath = path.posix.normalize(path.dirname(filePath) + '/' + dependencyPath);
            }else{
              dependencyPath = dependencyPath.split('/');
              dependencyPackage = dependencyPath.shift();
              dependencyPath = dependencyPath.join('/');
            }

            //should also check if dependency is there under other file extensions?

            if(typeof loadedPackages[dependencyPackage] !== "undefined"
            && typeof loadedPackages[dependencyPackage][dependencyPath] !== "undefined") continue;

            if(typeof packagesWithFilesToLoad[dependencyPackage] !== "undefined"){
              if(typeof packagesWithFilesToLoad[dependencyPackage][dependencyPath] !== "undefined") continue;
            }else{
              packagesWithFilesToLoad[dependencyPackage] = {};
            }

            if(debug) console.log("Adding Dependency ", dependencyPackage, dependencyPath);

            packagesWithFilesToLoad[dependencyPackage][dependencyPath] = false;
          }
        }

        getDescriptor();
      });
    }

    getDescriptor();
  }catch(event){
    let error = {
      type:             event.type,
      message:          event.message,
      lineNumber:       event.lineNumber,
      fileName:         event.fileName,
      stack:            event.stack
    };

    console.log(event.stack);
    result.status(500).json(error);


    // if (debug) result.write("\n\n" + event.stack);
  }
});

var getURL = function(url){
  return new Promise((resolve, reject) => {
    let options = new URL(url);

    let chunks = [];
    https.get(url, res => {
      if(res.statusCode !== 200){
        return reject(res.statusCode, res.statusMessage);
      }

      res.on('data', chunk => {
        chunks.push(chunk);
      });

      res.on('end', chunk => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', error => {
      reject(error);
    });
  });
}

var deployModuleVersion = function(packageJSON, message){
  return new Promise((resolve, reject) => {
    let modulePath = 'modules/' + packageJSON.name;
    let versionPath = modulePath + '/' + message.version;

    packageJSON.versions[message.version] = {
      files: {},
      timestamp: Date.now()
    }

    // normalize filenames using posix

    for(filename in message.files){
      packageJSON.versions[message.version].files[filename] = md5(message.files[filename]);
    }

    database.createDirectory(versionPath).then(success => {
      database.write(modulePath + '/package.dcp', packageJSON, false).then(signedFile => {
        let promises = [];
        for(filename in message.files){
          promises.push(database.store(versionPath + '/' + filename, message.files[filename]));
        }

        Promise.all(promises).then(signedFiles => {
          resolve(signedFile); // send the signed package.json file back
        });
      });
    });
  });
}

var deployModuleFromRequest = function(request, result){
  let signedMessage = request.body;
  let message = signedMessage.message;

  // console.log(JSON.stringify(signedMessage, null, 2));

  // check for npm module under the same name
  getURL('https://registry.npmjs.org/' + message.name).then(response => {
    // check if they are the owner using e-mail or signed message from same ssh
    result.status(409).json({
      error: "Module name conflicts with NPM.",
      module: JSON.parse(response.toString())
    });
    result.end();
  }).catch((statusCode, statusMessage) => {
    if(statusCode == 404){ // module name not found in NPM repo's
      let modulePath = 'modules/' + message.name;
      // check for existing module
      database.exists(modulePath).then(status => {
        // aleady exists check for versions
        database.read(modulePath + "/package.dcp", false).then(signedPackage => {
          let packageJSON = signedPackage.message;
          if(packageJSON.owner !== signedMessage.owner){
            result.status(409).json({
              error: "Module name conflicts with an existing DCP Module.",
              module: signedPackage
            });
            return result.end();
          }

          let versions = Object.keys(packageJSON.versions);
          for(let i = 0; i < versions.length; i++){
            if(versions[i] >= message.version){
              result.status(409).json({
                error: "Module version conflicts with existing versions. Must deploy with a higher version number.",
                module: signedPackage
              });
              return result.end();
            }
          }

          deployModuleVersion(packageJSON, message).then(signedPackageJSON => {
            result.json(signedPackageJSON);
          });
        });
      }).catch(error => {
        if(error.code === "ENOENT"){ // module does not exist
          database.createDirectory(modulePath).then(success => {
            let packageJSON = {
              owner: signedMessage.owner,
              name: message.name,
              versions: {}
            }

            deployModuleVersion(packageJSON, message).then(signedPackageJSON => {
              result.json(signedPackageJSON);
            });
          });
        }else{
          // some other error for module directory
        }
      });
    }else{
      // some other connection error to registry.npmjs.org
    }
  });
}

app.post('/deploy/module', deployModuleFromRequest);

server.listen(config.listen_port, config.listen_host);
console.log('Server listening on ' + config.listen_host + ":" + config.listen_port);
