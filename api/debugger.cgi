#!/bin/bash
# **************************************************
# Write to debug log file 
# **************************************************

### Setup
debugfile=../cache/debug.log
bakfile=../cache/debug.log.bak

### Get Parameters
read params
section=`echo $params | cut -f1 -d'|'`
message=`echo $params | cut -f2 -d'|'`

### Process
line="`date` [$section] $message"
echo $line >> $debugfile
retval="{\"success\": true}"

### Housekeeping
lines=`cat $debugfile | wc -l`
if [ $lines -gt 99999 ]; then
    mv $debugfile $bakfile
    tail -50000 $bakfile > $debugfile   # Reduce number of lines by half.
fi

### Response
echo "Content-Type: application/json; charset=UTF-8"
echo ""
echo $retval
