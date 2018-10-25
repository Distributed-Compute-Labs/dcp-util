# Utilities in this repo:
- dcpjob: compile, sign and deploy jobs and generators. Fetch results for jobs / generators.
- dcpmine: start mining on the dcp network from a node instance.

## dcpjob

#### Examples
- See the examples directory, currently only the prime example is set up (June 2018)

#### Example Usage:
- node dcpjob compile examples/prime/job.json
- node dcpjob sign examples/prime/job.dcp --jobBoard=board.dcp.test
- node dcpjob deploy examples/prime/job.tx

#### To deploy a job:
 - node dcpjob deploy examples/prime/job.json --type=job --jobBoard=http://core.goblin.test

#### To deploy a generator:
 - node dcpjob deploy examples/prime/generator.json --type=generator --jobBoard=http://core.goblin.test

#### Note about deploying generators for a job:
 - after deploying a job you must take its address and go into your generator.json file
   and change the 'job' field to be that jobs address. (Or use the --job='address' options [not yet implemented - June 2018])

## dcpmine

#### To be written