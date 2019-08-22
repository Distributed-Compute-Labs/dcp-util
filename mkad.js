#! /usr/bin/env node
/**
 *  @file       mkad.js
 *              Mamipulate Keystore Data.
 * 
 *              DCP-661: https://kingsds.atlassian.net/browse/DCP-661
 *
 *  @author     Badrdine Sabhi, badr@kingsds.network
 *  @date       July 2019
 */

require('dcp-rtlink/rtLink').link(module.paths)
const dcpConfig = require('config').load() // eslint-disable-line
require('dcp-client/dist/compute.min.js') /* side effect: global protocol now defined :( */

const path = require('path')
const process = require('process')
const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})
const ethWallet = require('ethereumjs-wallet')
const ethUtil = require('ethereumjs-util')
//const stripHexPrefix = require('strip-hex-prefix');
const keyPassphrase = ''

/** 
 * mkad utility usage information
 */
function usage() {
    var progName = path.basename(process.argv[1])

    console.log(`
${progName} - Manipulate Key/Address Data.
Copyright (c) 2019 Kings Distributed Systems Ltd., All Rights Reserved.
  
Usage:      ${progName} new  <keystore | address | key> [ --f=filename ] [ --p=passphrase] [--force]
            ${progName} show <keystore | address | key> [[ --f=filename ] | <data>] [ --p=passphrase ]
            ${progName} info [[ -f "input filename" ] | <data>]
  

Examples:   ${progName} new keystore -f=someFilename --passphrase=somePassphrase --force
            ${progName} new keystore -f=someFilename --passphrase=somePassphrase
            ${progName} new keystore -f=someFilename --force
            ${progName} new keystore -f=someFilename

            ${progName} new address -f=someFilename --force
            ${progName} new address -f=someFilename

            ${progName} new key -f=someFilename --force
            ${progName} new key -f=someFilename


            ${progName} show keystore -f=someFilename --passphrase=somePassphrase
            ${progName} show keystore 0xSomeHexadecimalKey --passphrase=somePassphrase
            ${progName} show keystore -f=someFilename
            ${progName} show keystore 0xSomeHexadecimalKey

            ${progName} show address -f=someFilename
            ${progName} show address 0xSomeHexadecimalKey

            ${progName} show key -f=someFilename
            ${progName} show key 0xSomeHexadecimalKey

            ${progName} info -f=inputFilename
            ${progName} info 0xSomeHexadecimalKey   


Where:      new         creates a new keystore, address, or key.
            info        describes a given keystore, address, or key
            data        is an address or a key in hexadecimal, with or without the leading 0x
            filename    is the name of a file, which may contain a key store, address, or key.  
            dash (-)    means stdin or stdout.
            -p          specifies a keystore passphrase.  The empty string is an acceptable passphrase.
            --force     allows an existing keystore file to be overwritten   


Global Options:
            --help          view this help                            
    `)
    process.exit(1)
}


/** Parse an argument vector, removing arguments which have been parsed, returning an options
 *  object. Arguments are key value parts. Arguments without a value are treated as true.
 *
 *  @param      args            The argument.
 *  @param      array           An array of strings containing the list of arguments to parse.
 *  @param      options         Options object to populate - if undefined, use {}
 *  @param      forceAll        If true and not all arguments parsed, display an error and exit.
 *
 *  @returns                    Options object
 */
function parseOptions(args, array, options, forceAll) {
    if (!options) options = {}
    for (let i = 0; i < args.length; i++) {
        if ((args[i][0] !== '-' && args[i][1] !== '-') || (args[i][0] !== '-' && args[i][1] !== 'f')) continue
        if(args[i].startsWith("--f=")) continue
        let equalPosition = args[i].indexOf('=')
        if (equalPosition === -1) {
            options[args[i].slice(2)] = true
            continue
        }
        let key
        if (args[i][1] === 'f')
            key = args[i].slice(1, equalPosition)
        else
            key = args[i].slice(2, equalPosition)
        let value = args[i].slice(equalPosition + 1)
        if (array.indexOf(key) === -1) {
            if (forceAll) {
                console.error('Unrecognized option:', key, value)
                process.exit(1)
            }

            continue
        }
        options[key] = value
    }

    return options
}

/** Returns the exact value(s) from the generated keystore object.
 *
 *  @param      keyType                 A string of data type being processed.
 *  @param      args                    The argument.
 *  @param      options                 Options object to populate - if undefined, use {}
 *  @param      keystoreFromPrivkey     A keystore object generated from Private Key.
 */
var showEtherFile = (keyType, args, options, keystoreFromPrivkey = null) => new Promise((resolve, reject) => {
    let keystoreObj
    keystoreFromPrivkey ? keystoreObj = keystoreFromPrivkey : keystoreObj = JSON.parse(fs.readFileSync(options.f, 'ascii'))
    let pass = options.passphrase ? options.passphrase : this.keyPassphrase
    try {
        if (pass) {
            wallet = ethWallet.fromV3(keystoreObj, pass, true)
        } else {
            wallet = ethWallet.fromV3(keystoreObj, '', true)
        }
        switch (keyType) {
            case 'keystore':
                resolve(keystoreObj)
                break
            case 'address':
                resolve(wallet.getAddress())
                break
            case 'key':
                resolve(ethUtil.bufferToHex(wallet.getPrivateKey()))
                //resolve(wallet.getPrivateKey())
                break
            default:
                console.log(`Mode ${fileType} is undefined`)
                usage();
        }
        // return resolve(keystoreObj)
    } catch (error) {
        return reject(error)
    }
}).catch(error => { console.log(error) })

/** Creates a wallet object and stores it as a keystore file in the given file path
 *
 *  @param      fileType        A string that specify the data type being requested
 *  @param      filePath        The path where the generated file will be stored
 *  @param      passphrase      The passphrase for the generated keystore
 *  @param      force           Argument overwrite data file forcefully
 *  @param      hexPrivkey      A hexadecimal private key. 
 */
var createEtherFile = (fileType, filePath, passphrase, force = false, hexPrivkey = false) => new Promise((resolve, reject) => {
    let wallet
    let keystore
    let address
    let key
    let storedObj
    if (hexPrivkey) {
        wallet = ethWallet.fromPrivateKey(ethUtil.toBuffer(hexPrivkey))
    } else {
        wallet = ethWallet.generate()
    }
    try {
        switch (fileType) {
            case 'keystore':
                keystore = wallet.toV3(passphrase, { n: 1024 })
                storedObj = keystore
                break
            case 'address':
                //address = ethWallet.generateVanityAddress() /*create an instance where the address is valid against the supplied pattern (this will be very slow) */
                address = wallet.getAddress()
                storedObj = address
                break
            case 'key':
                //key = ethUtil.bufferToHex(wallet.getPrivateKey())
                key = wallet.getPrivateKey()
                storedObj = key
                break
            default:
                console.log(`Mode ${fileType} is undefined`)
                usage();
        }

        if (hexPrivkey) {
            // storedObj.address = stripHexPrefix(hexPrivkey);
            resolve(storedObj)
        }

        fs.stat(filePath, (error, status) => {
            if (error) {
                fs.writeFileSync(filePath, JSON.stringify(storedObj, null, 2))
                resolve(`${fileType} created and stored in ${filePath}`)
            } else if (force) {
                fs.writeFileSync(filePath, JSON.stringify(storedObj, null, 2))
                resolve(`${fileType} file successfully overwritten and stored in ${filePath}`)
            } else {
                resolve('Filename already exists')
            }
        })
    } catch (error) {
        reject(error)
    }

}).catch(error => { console.log(error) })


/** Initiates keystore object creation and sets up a password questionnaire
 *
 *  @param      fileType     A string that specifies the data type being requested.
 *  @param      args         The argument.
 *  @param      options      An object that defines the main parameters that will be used.
 */
var newEtherFile = (fileType, args, options) => new Promise((resolve, reject) => {
    let passphrase = options.passphrase
    let filePath = options.f ? options.f : ''
    if (filePath.length === 0) filePath = `myDCP${fileType}.keystore`
    if (!passphrase && fileType == 'keystore') {
        rl.setPrompt(`Create ${fileType} with empty passphrase <yes or no>? `)
        rl.prompt()
        rl.on('line', answer => {
            if (answer.trim() == 'yes') {
                passphrase = ''
                resolve(createEtherFile(fileType, filePath, passphrase, options.force, options.privkey))
            } else if (answer == 'no') {
                rl.question('Enter Passphrase: ', pass => {
                    passphrase = pass
                    //assign the passphrase to this global const because show keystore 0xsomeHex does not pass the passphrase with the options object
                    this.keyPassphrase = pass
                    resolve(createEtherFile(fileType, filePath, passphrase, options.force, options.privkey))
                })
            } else {
                rl.setPrompt(`Create ${fileType} with empty passphrase <yes or no>? `)
                rl.prompt()
            }
        })
    } else {
        resolve(createEtherFile(fileType, filePath, passphrase, options.force, options.privkey))
    }
}).catch(error => { console.log(error) })

/** Starts the creation process of the keystore file */
var createKey = async (args, options) => {
    let result
    var keyType = args[0]
    args = args.slice(1)
    if (!options.f) usage()
    if (keyType == 'keystore' || keyType == 'address' || keyType == 'key') {
        return await newEtherFile(keyType, args, options)
    } else {
        console.error('Invalid mode: ' + mode)
        process.exit(1)
    }
}

/** returns the stored or generated keystore file to show its content based on passed arguments */
var showKey = async (args, options) => {
    let keystoreFromPrivkey
    var keyType = args[0]
    if (!options.f) {
        if (ethUtil.isValidPrivate(ethUtil.toBuffer(args[1]))) {
            options.privkey = args[1]
            keystoreFromPrivkey = await newEtherFile(keyType, args, options)
            return keystoreFromPrivkey;
        } else {
            console.error(`Invalid Hex Key: ${args[1]}`)
            process.exit(1)
        }
    } else {
        args = args.slice(1)
        if (keyType == 'keystore' || keyType == 'address' || keyType == 'key') {
            return await showEtherFile(keyType, args, options, keystoreFromPrivkey)
        } else {
            console.error('Invalid mode: ' + mode)
            usage()
        }
    }
}

/** Grabs info from passed keystore file or Hexadecimal key */
var infoKey = async (args, options) => {
    let privKey = args[0]
    if (!options.f) {
        if (ethUtil.isValidPrivate(ethUtil.toBuffer(privKey))) {
            pubKey = ethUtil.bufferToHex(ethUtil.privateToPublic(args[0]))
            addressKey = ethUtil.bufferToHex(ethUtil.privateToAddress(args[0]))
            res = `Valid Private Key: ${privKey} \nPublic Key: ${pubKey} \nAddress: ${addressKey}`
            return res;
        } else {
            console.error(`Invalid Hex Key: ${privKey}`)
            process.exit(1)
        }
    } else {
        //args = args.slice(1)
        keystoreObj = JSON.parse(fs.readFileSync(options.f, 'ascii'))
        res = `keystore version: ${keystoreObj.version} \nAdress: ${keystoreObj.address} \nSymmetric Advanced Encryption Standard: ${keystoreObj.crypto.cipher} \nKey Derivation Function: ${keystoreObj.crypto.kdf}`
        return res
    }
}

/** Main program entry point */
var main = async argv => {
    let result
    var mode = argv[1]
    var options, privateKey
    argv = argv.slice(1)
    options = parseOptions(argv, ['f', 'passphrase'])

    if (!mode || options.help) { usage() }

    switch (mode) {
        case 'new':
            result = await createKey(argv.slice(1), options)
            console.log(result)
            break
        case 'show':
            result = await showKey(argv.slice(1), options)
            console.log(result)
            break
        case 'info':
            result = await infoKey(argv.slice(1), options)
            console.log(result)
            break
        default:
            console.error('Invalid mode: ' + mode)
            process.exit(1)
    }
    process.exit(1)
}

main([].concat(process.argv).slice(1))