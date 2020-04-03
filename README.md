# dcp-util

DCP Command Line Utilities

# Development

You need to build a local dcp-client. (And for now, to check out the right branch):

    git checkout improvement/argv-scheduler
    npm link
    
(link will allow us to use the branch from the other repos)

In dcp:

    git checkout improvement/dcp-cli-util
    npm link dcp-client
    ./install.sh -N dcp-client

   (Some errors will be generated, but it still works ok (I think its due to the symlinks from linking, need to investigate that sometime))

Get dcp-util and install:

    git clone git@gitlab.com:Distributed-Compute-Protocol/dcp-util.git
    cd dcp-util
    npm i

Then
    
    npm link dcp-client

# Test away!

```
bin/mkad create --passphrase=secret
bin/job-utility listJobs --scheduler=http://my-scheduler.office.kingsds.network
bin/schedmsg announce "Hello, world!" --scheduler=http://my-scheduler.office.kingsds.network
```