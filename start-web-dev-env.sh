#! /bin/bash

# exit when any command fails
set -Eeo pipefail

# keep track of the last executed command
trap 'last_command=$current_command; current_command=$BASH_COMMAND' DEBUG
# echo an error message before exiting
#trap 'echo "\"${last_command}\" command failed with exit code $?."' EXIT

GNU_SYSTEM="`uname -a | grep GNU || true`"

if ! [ -x "$(command -v realpath)" ]; then
  # This implementation depends on the fact that this file only uses it on directories
  realpath()
  {
    echo "$(cd "$1"; pwd -P)"
  }
fi

top_dir="`dirname $0`"
top_dir="`realpath \"${top_dir}\"`"

prefix="$top_dir/.."

sudo_user=${1:-}

if [ "$GNU_SYSTEM" ]; then
  gnome-terminal \
    --window --working-directory="$prefix" -e "sudo --user=$sudo_user bash -c bin/start-bank.sh" \
    --tab --working-directory="$prefix" -e "sudo --user=$sudo_user bash -c bin/start-scheduler.sh" \
    --tab --working-directory="$prefix" -e "sudo --user=$sudo_user bash -c bin/start-portal.sh" \
    --tab --working-directory="$prefix" -e "sudo --user=$sudo_user bash -c bin/start-package-manager.sh" \
    1>/dev/null # To hide -e deprecation warnings on stdout
else
  # TODO: Implement for Mac; consider ttab
  exit 99
fi
