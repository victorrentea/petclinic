---
# Harness auto-injects its body before any file of this type is accessed.
paths: ["**/pom.xml"]
---

- Before adding or bumping a dependency, run `mvn -q help:evaluate -Dexpression=project.dependencyManagement -DforceStdout | grep -A2 '<artifactId>THE_ARTIFACT</artifactId>'`: a hit means managed (no `<version>`; to change it, override its `*.version` property), no hit means it needs a `<version>`.
