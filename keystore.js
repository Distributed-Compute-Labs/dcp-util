/**
 * @file    loadKeystore.js
 *			Backend library to load keystores for use with DCP
 *
 * @author  Duncan Mays
 *			Duncan@kingsds.network
 * @date    May, June 2019
 */

const path = require('path')
const fs = require('fs')
const expandTilde = require('expand-tilde')
const ether = require('ethereumjs-wallet')
const pprompt = require('password-prompt')

//This class exists so that in the event this must be adapted to work in browser, 
// it will simply hang dcpKeystoreUtility (initialized down at the bottom) off of global
class DcpKeystoreUtility {

	constructor () {
		/**
		 *This function prompts the user for a string (a password), and returns it. It will also hide what the user types
		 *
		 *@param {string} - gets displayed to the user at the prompt
		 *
		 *@returns {string} - whatever the user types
		 */
		this.passphrasePrompt = (prompt) => pprompt(prompt, { method: 'hide' })
	}

	/**
	 *This function takes a file path with symbols like . .. and ~, and expands them into the
	 * propper paths that they represent, so ~ turns into the user's home directory, . into 
	 * the current directory, and so on.
	 *
	 *@param {string} filePath
	 *
	 *@returns {string}
	 */
	expandFilePathSymbols (filePath) {
		//if a ~ is given in the filePath, this line expands that to be the current user's home directory
		filePath = expandTilde(filePath)

		//takes out any . or ..s
		return path.resolve(filePath)
	}

	/**
	 *This function returns a wallet generated from a private key. If no private key is specified it will generate a
	 * random one and return a wallet corresponding to it
	 *
	 *@param {Buffer} - a private key corresponding to the wallet that the caller wishes to load
	 *
	 *@returns {wallet object}
	 */
	generateWallet (privKey) {
		//the address and other wallet iformation is determined from the private key using the ethereum library
		//this mapping is not injective, but the probability of two privKeys producing the same address is intracktable

		let wallet
		if (privKey) {
			wallet = ether.fromPrivateKey(privKey)
		} else {
			//if a private key is not specified, one will be randomly generated
			wallet = ether.generate()
		}
		return wallet
	}

	/**
	 *This function takes an encrypted keystore and returns its address without decrypting it
	 *
	 *@param {keystore}
	 *
	 *@returns {Buffer}
	 */
	getAddress (keystore) {
		//just following specs
		return keystore.address
	}

	/**
	 *This function loads a keystore from a file, decrypts it, and then returns the enclosed wallet. I does this
	 * in many ways depending on the options given to it.
	 *
	 *@param {object} options - three accepted keys: name, which specifies the name of the keystore, dir,
	 * which specifies its directpry, and checkEmpty, which controls weather or not unlock() will 
	 * attempt an empty password on the keystore before prompting the user
	 *
	 *@returns {wallet} - returns a wallet object that can be used in DCC transactions
	 */
	async getWallet (options, secondParam) {
		//the default configuration for loading wallets, note that normally checkEmpty would be specified but undefined is falsey and so this is not neccessary
		let optionsObj = {dir:expandTilde('~')+'/.dcp', name:'default.keystore'}
		//this parses the parameters of the function into a usable options object
		if ( (typeof(options) === 'object') && !Array.isArray(options) && !secondParam ) {
			//form 1
			// console.log('getWallet: form 1')
			//overwrites optionsObj with contents from options
			Object.assign(optionsObj, options)
		} else if ( (!options) && (!secondParam)) {
			//form 2
			// console.log('getWallet: form 2')
			//does nothing in order to use the default optionsObj
		} else if ( (typeof(options) === 'string') && (!secondParam) ) {
			//form 3
			// console.log('getWallet: form 3')
			optionsObj.name = options
		} else if (Array.isArray(options)) {
			//forms 4, 5, and 6
			//iterates over options, which to be clear is an array in these 3 forms, and adjusts optionsObj accordingly
			for (let i=0; i<options.length; i++) {
				switch (options[i]) {
					case '–private-key':
						//creates a new wallet corresponding to the provided private key
						return this.generateWallet(options[i+1])
						break;
					case '-i':
						//sets the name of the wallet to whatever is specified
						optionsObj.name = options[i+1]
						i++
						break;
					case '-p':
						//sets checkEmpty to false
						optionsObj.checkEmpty = false
						break;
				}//end of switch case statement
			}//end of for loop

			//forms 5 and 6
			if (secondParam) {
				if (typeof(secondParam) === 'string') {
					//form 6
					// console.log('getWallet: form 6')
					optionsObj.name = secondParam
				} else {
					//form 5
					// console.log('getWallet: form 5')
					//the second parameter is another options object that must be merged with the options specified in the options array, with hight priority
					Object.assign(optionsObj, secondParam)
				}
			} else {
				//form 4
				// console.log('getWallet: form 4')
			}
		}
		// process.stdout.write('getWallet options object: ')
		// console.log(optionsObj)
		const keystore = this.loadSync('', optionsObj).keystore
		const wallet = await this.unlock(keystore, optionsObj)
		return wallet
	}

	/**
	 *this function checks the safety requirements outlined in the Keystore API documentation
	 *on Wes's personal page. The requirements are that the file must niether be world readable or world writable, 
	 *or have any parent directory that is world writable. This function will return a boolean which indicates
	 *weather or not these conditions are met.
	 *
	 *@param {string} - filePath, this is the path to the file we are checking the safety of, this
	 * function will not work properly, and in fact will log a warning message, if that filePath 
	 * starts with either . or ..
	 *
	 *@returns {boolean} - indicates weather or not the file provided satisfies safety criteria
	 */
	isSafe (filePath) {
		//expands symbols like ~ and . in the filePath
		filePath = this.expandFilePathSymbols(filePath)

		//splits up the filepath into an array
		let pathArray = filePath.split(path.sep)
		//this will be the variable that the file path array will be reassembled into
		let reassemble

		if ((pathArray[0] === '.') || (pathArray[0] === '..')) {
			console.log('WARNING: isSafe() should not be passed any paths starting with .. or .')
		}

		//checks that the file is not world readable
		if (this.isWorldReadable(filePath)) {
			return false
		}

		//checks that the file and all its ancestor directories are not world readable
		while (pathArray.length > 0) {
			reassemble = pathArray.join(path.sep)
			if (this.isWorldWritable(reassemble)) {
				return false
			}
			pathArray = pathArray.slice(0,pathArray.length-1)
		}

		return true
	}

	/**
	 *This function takes a filepath and returns a boolean to indicate weather or not the location specified in the filepath is world readable
	 *
	 *@param {string} filePath - path to the file in question, does not work right if the filePath starts with . or ..
	 *
	 *@returns {boolean} - indicates weather the given file or directory is world readable
	 */
	isWorldReadable (filePath) {
		const mode = fs.statSync(filePath).mode
		return mode & 4
	}

	/**
	 *This function takes a filepath and returns a boolean to indicate weather or not the location specified in the filepath is world writable
	 *
	 *@param {string} filePath - path to the file in question, does not work right if the filePath starts with . or ..
	 *
	 *@returns {boolean} - indicates weather the given file or directory is world writable
	 */
	isWorldWritable (filePath) {
		const mode = fs.statSync(filePath).mode
		return mode & 2
	}

	/**
	 *This function takes a filepath and come configuration options, and returns an object containing a keystore stored at
	 * the given filepath, and a boolean to indicate weather or not the filepath specified is a safe location.
	 *
	 *@param {string} filePath - path to the keystore
	 *
	 *@returns {object} - {keystore: the file loaded from the keystore JSON, safe: a boolean that indicates safety}
	 */
	loadSync (filePath, options) {
		if (options) {
			//form 2

			//in form 2, the first parameter is the name of the file
			let name = filePath

			//options object can override the name parameter
			if (options.name) {name = options.name}

			//checks that the name does not start with . .. or path.sep
			if ( (name[0] === '.') || (name[0] === '..') || (name[0] === path.sep) ) {
				//if the filename starts with either of these things
				throw 'filename must not start with . .. or ' +path.sep+' when invoking form 2 of loadSync()'
				return
			}

			let directory = options.dir
			if (!directory) {
				//if the caller did not provide a directory
				throw 'you must provide a directory when invoking form 2 of loadSync()'
				return
			}

			let fullPath
			if (directory[directory.length-1] === path.sep) {
				fullPath = directory + name
			} else {
				//if the caller did not end the directory with path.sep
				fullPath = directory + path.sep + name
			}

			//invokes form 1 after determining the path
			return this.loadSync(fullPath)

		} else {
			//form 1

			//checks that the filePath starts with . .. or path.sep
			if ( !( (filePath[0] === '.') || (filePath[0] === '..') || (filePath[0] === path.sep) ) ) {
				//if the filename does not start with either of these things
				throw 'loadSync parameter must start with . .. or ' + path.sep
				return
			}

			//removes and expands unwanted symbols like . .. and ~
			filePath = this.expandFilePathSymbols(filePath)

			//gets the keystore from the JSON file
			const keystoreObj = JSON.parse(fs.readFileSync(filePath, 'ascii'))

			//puts keystore in an object with a safety indicator
			return {keystore:keystoreObj, safe: this.isSafe(filePath)}
		}
	}

	/**
	 *This function decrypts keystore files into the wallets they contain.
	 *
	 *@param {string} - keystore - The realative or absolute path to the keystore file that the caller wishes to load into protocol, the default locationg is
	 * assumed to be ~/.dcp/id.keystore
	 *
	 *@param {boolean} - checkEmpty - By default, this program will try to open the keystore without a password, and will only prompt the user for a password if
	 * it needs one, but sometimes, for very large keystore files, it would take a long time to attempt openning the keystore without a password. This
	 * paramater allows the caller to skip the intitial attempt at opening the keystore without a password and go straight to prompting the user for
	 * one.
	 */
	async unlock (keystore, options) {
		if (options) {
			//form 2

			if (options.checkEmpty) {
				try {
					//tries an empty password
					return ether.fromV3(keystore, '')
				} catch (error) {
					const password = await this.passphrasePrompt("please enter the password to the keystore: ")
					return ether.fromV3(keystore, password)
				}
			} else {
				const password = await this.passphrasePrompt("please enter the password to the keystore: ")
				return ether.fromV3(keystore, password)
			}
		} else {
			//form 1

			//simply creates an options object if none was supplied
			options = {checkEmpty:true}
			return await this.unlock(keystore, options)
		}
	}
} //end of KeystorUtility class

const dcpKeystoreUtility = new DcpKeystoreUtility()

module.exports = dcpKeystoreUtility