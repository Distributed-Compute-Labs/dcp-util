# Utilities in this repo:
- dcp-worker: start working on the dcp network from a node instance.

## dcp-worker

### Begin Work
- node dcp-worker.js start {payment address/keystore} [options]

#### Key Options
- --scheduler=<url of scheduler>  Connect to an alternate scheduler (default: https://scheduler.distributed.computer)
- --idKeystorePath=               Specify path to Identity keystore
- --cores=                        Number of worker threads to run. Default: (hardwareConcurrency - 1)
- --liveStatus                    Show a fancy console status display

