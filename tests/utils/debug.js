const debug = require('debug');

const debugError = debug('tests');
const debugInfo = debug('tests');
debugInfo.log = console.debug.bind(console);

module.exports = {
  debugInfo,
  debugError,
};
