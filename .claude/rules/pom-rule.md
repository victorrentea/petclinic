---
paths:
  - "**/pom.xml"
---

# Maven versions: let the parent resolve them

**Never hardcode a `<version>` that the parent POM or an imported BOM already manages.**
A redundant `<version>` silently pins the artifact, so the next parent upgrade stops
applying to it — the dependency drifts out of the tested, coherent set the BOM guarantees.

## Rules

1. **Managed artifact → omit `<version>` entirely.** If `dependencyManagement` (inherited
   or imported) resolves the artifact, the dependency block is just `groupId` + `artifactId`
   (+ `scope`). Same for `<plugin>` versions covered by `pluginManagement`.

2. **To change a managed version, override the parent's property — do not add `<version>`.**
   `spring-boot-starter-parent` declares its versions through properties, so redefining the
   property in `<properties>` is the sanctioned override and keeps one source of truth:

   ```xml
   <properties>
     <lombok.version>1.18.36</lombok.version>   <!-- overrides Boot's managed lombok -->
   </properties>
   ```

3. **Unmanaged artifact → explicit version, but via a property**, not inline, so it is
   visible and greppable next to the others:

   ```xml
   <properties>
     <springdoc.version>2.8.15</springdoc.version>
   </properties>
   ...
   <dependency>
     <groupId>org.springdoc</groupId>
     <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
     <version>${springdoc.version}</version>
   </dependency>
   ```

4. **Never invent a version number.** If you cannot confirm the artifact is unmanaged,
   check before writing anything (see below).

## Check before you add a `<version>`

```sh
mvn help:evaluate -Dexpression=project.dependencyManagement -DforceStdout \
  | grep -A2 '<artifactId>THE_ARTIFACT</artifactId>'
```

Output → it is managed: **omit** the version (or override the property).
No output → it is unmanaged: add a property-backed version.

## State of this repo (`petclinic-backend/pom.xml`, parent `spring-boot-starter-parent` 3.5.11)

| artifact | managed by parent? | correct form |
| --- | --- | --- |
| `org.projectlombok:lombok` | **yes** (1.18.36 via `${lombok.version}`) | `<version>` is redundant — drop it, keep the property |
| `org.mapstruct:*` | no | needs `${mapstruct.version}` |
| `org.springdoc:springdoc-openapi-starter-webmvc-ui` | no | needs an explicit version |
| `io.opentelemetry.instrumentation:opentelemetry-instrumentation-annotations` | no | needs an explicit version |

Anything with a `spring-boot-starter-*` or `spring-*` coordinate is managed by the Boot
parent: never give those a version. Artifacts covered by the imported `spring-ai-bom`
are managed too — only the BOM itself carries `${spring-ai.version}`.
