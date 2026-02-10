#!/usr/bin/env bash
set -euo pipefail

JACOCO_XML=target/site/jacoco/jacoco.xml
SRC_FILE=${1:-src/main/java/org/springframework/samples/petclinic/rest/dto/BindingErrorsResponse.java}

echo "Running tests and generating JaCoCo report..."
./mvnw test jacoco:report -q

if [[ ! -f "$JACOCO_XML" ]]; then
  echo "Jacoco report not found at $JACOCO_XML"
  exit 1
fi

echo "Extracting uncovered lines for $SRC_FILE"
python3 scripts/extract_jacoco_uncovered.py "$JACOCO_XML" "$SRC_FILE"
