#! /bin/bash -a
#
# @file         run-worker.sh
#               SVR4-style init script for the DCP Standalone Worker
#
#               The first word of argv is the operation mode of this script.
#               All other words are passed to the dcp worker as extra options.
#               Valid operation modes:
#
#               --              Run an unmanaged worker, stay in foreground
#               start           Start a managed worker, run in the background, detach
#                               from the controlling tty.
#               stop            Stop a managed worker
#               restart         Restart a managed worker, with the same arguments it was
#                               originally launched with
#               foreground      Start a managed worker, do not background, stay connected
#                               to the controlling tty
#
#               Note: Only one managed worker per ID_LABEL is possible at a time on a given host.
#                        
# @author       Wes Garland, wes@kingsds.network
# @date         Nov 2019
#

# Locate the DCP directory, so that we can locate the worker and the run directory
progName="`realpath \"$0\"`"
cd "`dirname \"$progName\"`"

if [ ! "$DCP" ]; then
  if [ -f './get-config-value.js' ]; then
    DCP="`./get-config-value.js installLocation`"
  else
    confObj="`cat ../etc/local-config.json`"
    DCP="`echo \"console.log(${confObj}.dcp_root)\" | node`"
  fi
fi

[ ! "$DCP" ] && echo "Could not locate DCP install directory; please set DCP environment variable" >&2 && exit 98

# Configuration options
[ "$LOGDIR" ]           || LOGDIR="$DCP/log/dcp-worker"
[ "$WORKER" ]           || WORKER="$DCP/bin/dcp-worker.js"
[ "$PID_PDIR" ]         || PID_PDIR="$DCP/run"
[ "$ID_LABEL" ]         || ID_LABEL="dcp-worker"
[ "$PIDDIR" ]           || PIDDIR="$PID_PDIR/${ID_LABEL}"
[ "$PIDFILE" ]          || PIDFILE="$PIDDIR/pid"
[ "$SYSLOG_FACILITY" ]  || SYSLOG_FACILITY="local7"
[ "$ADDRESS" ]          && extraOpts="${extraOpts}${ADDRESS} "
[ "$SCHEDULER" ]        && extraOpts="${extraOpts}--scheduler=${SCHEDULER} "

# capture argv for restart
argvZero="$0"
allArgs="`
allArgs=''
while [ \"$1\" ]
do
  allArgs=\"${allArgs} \\\"$1\\\"\"
  shift
  echo \"$allArgs\"
done | tail -1`"

# parse arguments
while [ "$1" = " " ]; do shift; done
oper="$1"
shift
extraOpts="$* ${extraOpts}"

if [ ! "$DCP" ]; then
  echo "Could not locate DCP directory and DCP environment variable unset. Stop."
  exit 3
fi

assertDir()
{
  DIR="$1"

  if ! mkdir -p "${DIR}"; then
    echo "Could not create directory '${DIR}'; quit" >&2
    exit 1
  fi
}

errmsg()
{
  echo "$*" >&2
  logger -t dcp-worker -p ${SYSLOG_FACILITY}.notice "$*"
}

debug()
{
  [ ! "$DEBUG" ] && return
  echo "$*"
  logger -t dcp-worker -p ${SYSLOG_FACILITY}.debug "$*"
}

fail()
{
  errmsg $*
  exit 99
}

runWorker_inner()
{
  (
    if [ "$detach" ]; then
      debug "Detaching from controlling tty"
      trap "" "PIPE" "HUP"
      exec 0<&-
      exec 1<&-
      exec 2<&-
    fi

    (
      [ "$detach" ] && trap "" HUP
      [ "$daemon" ] && trap "rm -f \"${PIDFILE}\"; rmdir \"${PIDDIR}\"" EXIT
      mv "${LOGFILE}" "${LOGDIR}/supervisor.${now}.$BASHPID"
      echo "Starting worker pid $BASHPID on `hostname` at `date`, user=`id -un`"
      if [ "$daemon" ]; then
        if ! echo "$BASHPID" > "${PIDFILE}"; then
          errmsg "Cannot write '${PIDFILE}' - exit"
          exit 2
        fi
        echo "${allArgs}" >> "${PIDFILE}"
        echo "'${WORKER}' start $ADDRESS --scheduler='${SCHEDULER}' ${extraOpts}" >> "${PIDFILE}"
      fi
      exec "${WORKER}" start $ADDRESS --scheduler="${SCHEDULER}" ${extraOpts}
      echo "${WORKER} failed to start!"
      errmsg "${WORKER} failed to start!"
    ) | tee "$LOGFILE"
  )
}

runWorker()
{
  assertDir "$LOGDIR"
  if [ "$1" = "daemon" ]; then
    daemon=1
  else
    if [ "$1" = "detach" ]; then
      detach=1
      daemon=1
    fi
  fi

  debug "pid file is '${PIDFILE}'"
  if [ "$daemon" ]; then
    assertDir "$PID_PDIR"
    if [ -s "$PIDFILE" ]; then
      pid="`head -1 \"$PIDFILE\"`"
      if kill -0 "$pid"; then
        fail "DCP Worker already running as pid $pid!"
      else
        rm -f "$PIDFILE"
      fi
    fi

    [ -d "$PIDDIR" ] && rmdir "$PIDDIR"
    if [ "$daemon" ] && [ -d "$PIDDIR" ]; then
      fail "Semaphore directory $PIDDIR exists; not starting worker"
    fi
    if ! mkdir "$PIDDIR"; then
      fail "Could not create semaphore directory $PIDDIR; not starting worker"
    fi
  fi

  [ "$daemon" ] && debug "daemon mode - will write pidfile $PIDFILE"
  now="`date +%s`"
  LOGFILE="${LOGDIR}/supervisor.${now}.random-${RANDOM}"
  MASTER_PPID=$$

  if [ "$detach" ]; then
    runWorker_inner &
  else
    runWorker_inner
  fi
}

sleepo()
{
  total="$1"
  pid="$2"
  shift 2

  while [ "$total" -ge 0 ]
  do
    kill -0 "$pid" 2>/dev/null || break
    total="$[$total - 1]"
    sleep 1
    echo $*
  done
}

# Handle systems (e.g. Mac OS X) where echo is not GNU echo
if [ "`echo -n`" != "" ]; then
  echo ()
  {
    if [ "$1" = "-n" ]; then
      printf "%s" "$*"
    else
      echo "$*"
    fi
  }
fi

killWorker()
{
  if [ ! -f "${PIDFILE}" ]; then
    debug "${PIDFILE}: no such file"
    return
  fi

  pid="`head -1 ${PIDFILE}`"
  debug "Killing `tail -1 \"$PIDFILE\"`"

  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "${PIDFILE}"
    debug Worker was not running
    return
  fi

  echo -n "Killing process $pid.."
  while [ -f "${PIDFILE}" ]; do
    echo -n .
    if ! kill -INT "$pid" 2>/dev/null; then
      rm -f "${PIDFILE}"
      rmdir "${PIDDIR}"
      echo
      return
    fi
    sleepo 5 "$pid" -n .
    if ! kill "$pid" 2>/dev/null; then
      rm -f "${PIDFILE}"
      rmdir "${PIDDIR}"
      echo
      return
    fi
    sleepo 5 "$pid" -n .
    if ! kill -9 "$pid" 2>/dev/null; then
      rm -f "${PIDFILE}"
      rmdir "${PIDDIR}"
      echo
      return
    fi
    sleepo 15 "$pid" -n .
    echo
    echo -n "Killing pid $pid..."
  done
}

case "$oper" in
  "--")
    debug "Running unmanaged worker"
    runWorker
  ;;
  foreground)
    debug "Running worker as foreground daemon"
    runWorker daemon
  ;;
  start)
    debug "Running worker as daemon, detached from controlling tty"
    runWorker detach
  ;;
  stop)
    debug "Stopping worker"
    killWorker
  ;;
  restart)
    debug "Stopping worker..."
    allArgs="`head -2 \"${PIDFILE}\" | tail -1`"
    killWorker
    [ "$allArgs" ] || allArgs='start'
    debug "Restart worker as $argvZero ${allArgs}"
    eval exec "$argvZero" ${allArgs}
  ;;
  loop)
    trap "" HUP
    trap "DIE=1" INT QUIT TERM
    while [ ! "$DIE" ]
    do
      sleep 1
      runWorker daemon
    done
  ;;
  *)
    echo "OPER: $oper"
    echo "Usage: $argvZero <--|foreground|start|stop|restart> [extra dcp-worker.js options]"
  ;;
esac
