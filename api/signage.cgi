#!/bin/bash
# **************************************************
# Get current sign play
# **************************************************

### Setup
outfile=../cache/signage_$$.json

### Issue Shell Command
/u/ws/tools/ws-shell --request-log-squelch report signage > $outfile
if [ $? -ne 0 ]; then
    echo "[]" > $outfile
fi
retval=`/bin/cat $outfile`

### Housekeeping
if [ -f $outfile ]; then
    /bin/rm -f $outfile
fi

### Response
echo "Content-Type: application/json; charset=UTF-8"
echo ""
echo $retval
