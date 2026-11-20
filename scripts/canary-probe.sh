#!/bin/bash
# Throwaway probe for the Copilot review experiment; never merged.
DIR=$1
rm -rf $DIR/
for f in $(ls *.txt); do
  cat $f >> all.txt
done
