# ast-grep rules

Structural lint rules that enforce conventions already written in prose in
[CLAUDE.md](../CLAUDE.md). A convention nobody checks is a suggestion.

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

| rule | CLAUDE.md line it enforces | severity |
|---|---|---|
| `no-lombok` | "No Lombok in petclinic-backend" — matches any `import lombok.…` | error (0 occurrences) |
| `requestbody-needs-valid` | "@Validated on @RequestBody" | error |

Every rule must ship with `valid:` / `invalid:` cases in `rule-tests/`.
An untested rule that silently matches nothing is worse than no rule.

## Not implemented on purpose

"Keep line length ≤ 120 chars" — left as an exercise.
Note it is a *text* property, while ast-grep matches *syntax trees*.
