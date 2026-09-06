# ast-grep rules

Structural lint rules for conventions this repo holds to. Some restate a line of
[AGENTS.md](../AGENTS.md) — a convention nobody checks is a suggestion. Others are the
only statement of record: `no-lombok` and `no-mapstruct` say what AGENTS.md deliberately
no longer spends a line on, because neither library is in any `pom.xml` and an agent has
nothing to reach for. The rule is what makes that stick.

```sh
sg scan                 # scan the repo
sg test                 # run rule tests in rule-tests/
sg scan --update-all    # apply autofixes (none of the current rules define one)
```

Wired into `.githooks/pre-commit` twice: once over the staged Java files, and once over
the whole of `petclinic-backend/src` (~40ms, ungated) — because a merge resolution enters
the tree without anyone staging it, and a staged-files-only scan cannot see it. `git merge`
does not fire `pre-commit` at all, so `.githooks/pre-merge-commit` delegates to it.
`severity: error` blocks the commit; `severity: warning` only reports.

| rule | what it enforces | severity |
|---|---|---|
| `no-lombok` | Lombok is not used anywhere — matches any `import lombok.…` | error (0 occurrences) |
| `no-mapstruct` | DTO mapping is hand-written — matches any `import org.mapstruct.…` | error (0 occurrences) |
| `requestbody-needs-valid` | AGENTS.md: "@Validated on @RequestBody" | error |

Every rule must ship with `valid:` / `invalid:` cases in `rule-tests/`.
An untested rule that silently matches nothing is worse than no rule.

## Not implemented on purpose

"Keep line length ≤ 120 chars" — left as an exercise.
Note it is a *text* property, while ast-grep matches *syntax trees*.
