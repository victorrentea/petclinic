#!/bin/bash
# Throwaway probe for the Copilot review signature rule; never merged.
PORT=$1
kill -9 $(lsof -t -i :$PORT)
cp $2 /tmp/backup
