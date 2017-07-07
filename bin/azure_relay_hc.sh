#!/bin/bash  

current_dir=$(dirname "$0")
"$SPLUNK_HOME/bin/splunk" cmd node "$current_dir/azure_relay_hc.js" $@
