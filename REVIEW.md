# Review Rules
Auto-loaded by Claude Code `/code-review` and GitHub Copilot `/review`. Rules here apply
when judging a diff — authoring rules belong in [AGENTS.md](AGENTS.md).

- Every finding must name a concrete failing scenario — inputs → wrong result. If you can't
  write one, it's a preference, not a finding: drop it.
- Prefer .stream() over for in Java code
- Sign every message you post on a PR (the overview and each inline comment) with a last line
  `— <model> (effort: <level>, context: <used>/<window>)`, e.g.
  `— Claude Opus 5.5 (effort: high, context: 48k/1M)`. Write `?` for any value you don't
  actually know; never guess.
