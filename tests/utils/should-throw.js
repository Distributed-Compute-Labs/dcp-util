const debug = require('./debug');

/**
 * @param asyncFunctionToTest
 * @param testMessage
 * @param t
 * @param [testCondition]
 */
async function shouldThrow(asyncFunctionToTest, testMessage, t, testCondition) {
  try {
    const output = await asyncFunctionToTest();
    debug('Output:', output);
    t.fail(testMessage);
  } catch (error) {
    if (typeof testCondition === 'undefined') {
      t.ok(testMessage);
    } else {
      testCondition(error);
    }
  }
}

module.exports = shouldThrow;
