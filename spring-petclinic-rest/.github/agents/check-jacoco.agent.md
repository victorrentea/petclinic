# check-jacoco

A small MCP tool to query JaCoCo XML reports for per-line coverage.

Description
- Reads `target/site/jacoco/jacoco.xml` and answers whether a specific source file and line number are covered.
- Returns exit code 0 when covered, 1 when not covered, 2 when ambiguous (multiple matching sourcefiles), 3 for errors (report missing, parse error, or line not found).

Invocation
- The tool is a thin wrapper around `scripts/check_jacoco_line.py`.

Examples
- Check coverage for VetRestController line 75:
  - `tools/check-jacoco src/main/java/org/springframework/samples/petclinic/rest/controller/VetRestController.java 75`

Outputs
- Prints `covered: <file>:<line> (ci=.., mi=.., mb=.., cb=..)` when covered.
- Prints `not covered: <file>:<line> (...)` when not covered.
- JSON output can be produced with `--json` for programmatic consumption.

Notes
- The tool prefers `target/site/jacoco/jacoco.xml` by default; specify `--report` to override.
- If multiple sourcefiles share a basename, provide the full source path and ensure the package can be derived from it (src/main/java/.../package path).
