/**
 * CLI App Integration test helper
 * Author: Andrés Zorro <zorrodg@gmail.com>
 * Source: https://gist.github.com/zorrodg/c349cf54a3f6d0a9ba62e0f4066f31cb
 */

const { existsSync } = require('fs');
const { constants } = require('os');
const spawn = require('cross-spawn');
const concat = require('concat-stream');

const { PATH } = process.env;

/**
 * Creates a child process with script path
 *
 * @param {string} processPath Path of the process to execute
 * @param {string[]} [args] Arguments to the command
 * @param {object} [env] Environment variables
 * @returns {import('child_process').ChildProcess} the created child process
 */
function createProcess(processPath, args = [], env = null) {
  // Ensure that path exists
  if (!processPath || !existsSync(processPath)) {
    throw new Error(`Invalid process path "${processPath}"`);
  }

  /**
   * This works for node based CLIs, but can easily be adjusted to any other
   * process installed in the system.
   */
  return spawn('node', [processPath].concat(args), {
    env: {
      NODE_ENV: 'test',
      preventAutoStart: false,
      /**
       * This is needed in order to get all the binaries in your current
       * terminal.
       */
      PATH,
      ...env,
    },
    // This enables interprocess communication (IPC)
    stdio: [null, null, null, 'ipc'],
  });
}

/**
 * Creates a command and executes inputs (user responses) to the stdin.
 *
 * @param {string} processPath Path of the process to execute
 * @param {string[]} args Arguments to the command
 * @param {string[]} [inputs] Array of inputs (user responses)
 * @param {object} [opts]  Environment variables
 * @returns {Promise<string>} a promise that resolves when all inputs are sent.
 * Rejects the promise if any error.
 */
function executeWithInput(processPath, args = [], inputs = [], opts = {}) {
  if (!Array.isArray(inputs)) {
    opts = inputs;
    inputs = [];
  }

  const { env = process.env, timeout = 100, maxTimeout = 10000 } = opts;
  const childProcess = createProcess(processPath, args, env);
  childProcess.stdin.setEncoding('utf-8');

  let currentInputTimeout;
  let killIOTimeout;

  /**
   * Creates a loop to feed user inputs to the child process in order to get
   * results from the tool. This code is heavily inspired (if not blatantly
   * copied) from inquirer-test:
   * https://github.com/ewnd9/inquirer-/blob/6e2c40bbd39a061d3e52a8b1ee52cdac88f8d7f7/index.js#L14
   *
   * @param {string[]} inputs inputs to feed to the child process
   * @returns {undefined}
   */
  const loop = (inputs) => {
    if (killIOTimeout) {
      clearTimeout(killIOTimeout);
    }

    if (!inputs.length) {
      childProcess.stdin.end();

      /**
       * Set a timeout to wait for CLI response. If CLI takes longer than
       * maxTimeout to respond, kill the childProcess and notify user.
       */
      killIOTimeout = setTimeout(() => {
        console.error('Error: Reached I/O timeout');
        childProcess.kill(constants.signals.SIGTERM);
      }, maxTimeout);

      return;
    }

    currentInputTimeout = setTimeout(() => {
      childProcess.stdin.write(inputs[0]);
      // Log debug I/O statements on tests
      if (env && env.DEBUG) {
        console.log('input:', inputs[0]);
      }
      loop(inputs.slice(1));
    }, timeout);
  };

  const promise = new Promise((resolve, reject) => {
    // Get errors from CLI
    childProcess.stderr.on('data', (data) => {
      // Log debug I/O statements on tests
      if (env && env.DEBUG) {
        console.log('error:', data.toString());
      }
    });

    // Get output from CLI
    childProcess.stdout.on('data', (data) => {
      // Log debug I/O statements on tests
      if (env && env.DEBUG) {
        console.log('output:', data.toString());
      }
    });

    childProcess.stderr.once('data', (err) => {
      childProcess.stdin.end();
      if (currentInputTimeout) {
        clearTimeout(currentInputTimeout);
        inputs = [];
      }

      reject(err.toString());
    });

    childProcess.on('error', reject);

    // Kick off the process
    loop(inputs);

    childProcess.stdout.pipe(
      concat((result) => {
        if (killIOTimeout) {
          clearTimeout(killIOTimeout);
        }

        resolve(result.toString());
      }),
    );
  });

  /**
   * Appending the process to the promise, in order to add additional parameters
   * or behavior (such as IPC communication).
   */
  promise.attachedProcess = childProcess;

  return promise;
}

/**
 * @param {string} processPath
 * @returns {executeWithInput}
 */
const create = (processPath) => {
  const execute = (...args) => executeWithInput(processPath, ...args);
  return execute;
};

module.exports = {
  createProcess,
  create,
  DOWN: '\x1B\x5B\x42',
  UP: '\x1B\x5B\x41',
  ENTER: '\x0D',
  SPACE: '\x20',
};
