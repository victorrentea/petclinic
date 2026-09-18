# Java code style — extension

My own rules, on top of the team's `java-code-style` skill. They live outside that skill
on purpose: the skill is the team's (one day a plugin someone else versions), this file is
mine. A `PostToolUse` hook on the `Skill` tool appends it whenever that skill activates, so
neither side has to know about the other.

Nothing here contradicts the team rules — it only adds.

## Return types
- Don't return a `Stream` from a method; return a `List`. A `Stream` can be consumed once
  and forces the caller into a terminal operation. Exception: genuinely humongous data
  that must not be materialised.

## Conditionals
- Use the ternary operator only when the whole expression fits in half a line (~60 chars).
  Anything longer becomes an `if`/`else` — a wrapped ternary hides which branch is which.
