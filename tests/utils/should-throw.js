/**
 * @param asyncFunctionToTest
 * @param testMessage
 * @param t
 * @param [testCondition]
 */
async function shouldThrow(asyncFunctionToTest, testMessage, t, testCondition) {
  try {
    await asyncFunctionToTest();
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
