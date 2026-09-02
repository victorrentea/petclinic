# ─────────────────────────────────────────────────────────────────────────────
# C3 — Backend component structure.  CODE-COUPLED: this file tracks the Java code.
#
# NOT a standalone workspace — it is `!include`d into the `backend` container
# block of c4model.dsl.  Kept separate because, unlike the stable C1/C2 layer,
# every line here is unit-tested against the real code by C3ArchTest:
#   • each `pkg:<pattern>` tag must map to a real Java package (and vice-versa)
#   • each `src -> dst` edge below must match an actual cross-package dependency
#     in the code (and vice-versa) — no phantom, no missing edges.
# So when the code's package structure or dependencies change, this file (not the
# human C1/C2 diagram) is what the guardrail forces you to update.
# ─────────────────────────────────────────────────────────────────────────────

restLayer       = component "REST Layer"       "[rest.**] HTTP endpoints, DTOs, error handlers"        "Spring MVC"       "pkg:rest.**"
domainModel     = component "Domain Model"      "[domain] JPA entities"                                  "JPA"              "pkg:domain"
repositoryLayer = component "Repository Layer"  "[repository] Spring Data JPA repositories"             "Spring Data"      "pkg:repository"
mapperLayer     = component "Mapper Layer"      "[mapper] MapStruct mappers"                            "MapStruct"        "pkg:mapper"
security        = component "Security"          "[security] Spring Security configuration"              "Spring Security"  "pkg:security"
mcp             = component "MCP"               "[mcp] Spring AI MCP server (SSE) — tools and resources for pet owners" "Spring AI" "pkg:mcp"

restLayer       -> mapperLayer     "uses"
restLayer       -> domainModel     "uses"
restLayer       -> repositoryLayer "uses"
mapperLayer     -> restLayer       "uses"
mapperLayer     -> domainModel     "uses"
repositoryLayer -> domainModel     "uses"
mcp             -> domainModel     "uses"
mcp             -> repositoryLayer "uses"
