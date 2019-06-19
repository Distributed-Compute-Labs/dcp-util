/**
 * @file    arg_util.js
 *			Library to parse command line arguements
 *
 * @author  Duncan Mays
 			Duncan@kingsds.network
 * @date    May 2019
 */

/**
 *@param {Object} argObj - an object describing the command line arguements accepted by the program that is using this library. The object
 * is structured as follows, valid command line arguements are keys within the obect which correspond to values that can either by the
 * default value of that command line arguement, or be one of 3 strings, 'flag', 'number', and 'string'. These are the types of  inputs each
 * arguement will be. Flags are booleans, if they exist in process.argv, the output object will contain a key of the arguement with value
 * true. Numbers are numbers, if they are in process.argv, the output object will contain a key of the arguement with a value of whatever
 * comes after it in process.argv, if what comes after it is not a number or if it is at the end of pprocess.argv, the arguement is ignored.
 * If the type is string, the output object will contain key of the arguement with a value of whatever comes after it in process.argv parsed
 * into a string, if the arguement is at the end of process.argv, it is ignored.
 *
 *@param {boolean} devMode - By default invalid inputs, ie, CLI arguements that are not specified in the input abject or are otherwise not valid,
 * are simply ignored. If devMode is set to true, this program will log an error message describing what went wrong.
 *
 *@param {array} args - these are the arguements that parseArgs will look through to adjust the returned opbject, by defualt it is set to be
 * oricess.argv.slice(2), which are the command line arguements of a parent program's call in bash, but sometimes we want to look for
 * arguements in another array, so args is configurable in this way.
 *
 *@returns {Object} - Contains key value pairs of arguements and their value, dependant on the type of arguement specified in argObj
 */
function parseArgs(argObj, devMode = false, args = process.argv.slice(2)){
	let outObj = {}
	const name = process.argv[1].split('\\').pop().split('/').pop()

	//iterates over the keys in argObj
	for (i in argObj) {
		//first step is to add default arguements to outObj, if they are overwritten by any CLI arguements, it will be done below
		if (!((argObj[i] === 'boolean') || (argObj[i] === 'number') || (argObj[i] === 'string'))) {
			//if the value corresponding to i in argObj is neither 'boolean', 'number', or 'string', then it is a default value and is set in outObj
			outObj[i] = argObj[i]
		}

		//iterates over CLI arguements to see if they any match a key in argObj
		for (let j = 0; j < args.length; j++) {
			//tests if any CLI arguement matched a key in argObj
			if (args[j] === i) {
				if (argObj[i]==='boolean' || typeof argObj[i]==='boolean') {
 					outObj[i] = true

				} else if (argObj[i]==='number' || typeof argObj[i]==='number') {
					const arg = parseFloat(args[j+1])
					//if the following arguement is a number
					if (arg) {
						outObj[i] = arg
						//skips the next arguement since it was a number
						j++
					} else if (devMode) {
						console.log('ERROR in '+name+': '+args[j+1]+' must be a number to be a valid input for '+i)
					}

				} else if (argObj[i]==='string' || typeof argObj[i]==='string') {
					if (args[j+1]) {
						outObj[i] = args[j+1]
						j++
					} else if (devMode) {
						console.log('ERROR in '+name+': no value given for '+args[j])
					}

				} else if (devMode) {
					console.log('ERROR in '+name+': a CLI arguement matched a key in argObj but the value corresponding to it was niether a string, number or boolean.')
				}//end of if tree that decides the type of arguement
			}//end of if statement testing if any CLI arguements match any keys
		}//end of bottom for loop
	}//end of top for loop

	return outObj
}

module.exports = parseArgs