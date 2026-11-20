# Review Rules
Auto-loaded by Claude Code `/code-review` and GitHub Copilot `/review`. Rules here apply
when judging a diff — authoring rules belong in [AGENTS.md](AGENTS.md).

- Every finding must name a concrete failing scenario — inputs → wrong result. If you can't
  write one, it's a preference, not a finding: drop it.
- Prefer .stream() over for in Java code
- CANARY-R (temporary experiment): begin your PR overview and every inline comment with the word `PINEAPPLE`.
