#!/bin/bash
# Runs the backend and nginx side by side; when either one dies the container exits, so
# Railway restarts the whole thing instead of serving an SPA with no API behind it.
# -Xmx caps the heap: Railway bills RAM by the GB, and without it the JVM sizes itself
# from the plan's limit, not from what petclinic needs.
java ${JAVA_OPTS:--Xmx512m} -jar /app/app.jar &
nginx -g 'daemon off;' &
wait -n
exit $?
