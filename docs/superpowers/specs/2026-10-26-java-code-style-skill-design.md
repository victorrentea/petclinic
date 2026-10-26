# Java Code Style Skill

## Goal

Move the Java Code Style rules from `AGENTS.md` into a repository-local skill, keeping
the guidance available to contributors working on Java code without repeating the full
list in the top-level project instructions.

## Design

- Create `.claude/skills/java-code-style/SKILL.md`.
- Preserve the seven existing rules and their intent without adding unrelated conventions.
- Replace the rules in `AGENTS.md` with a short pointer to the skill.
- Keep the skill repository-local; do not install or modify any user-level skill.

## Validation

Review the diff to confirm all seven rules are present in the skill, the top-level file
points to it, and no unrelated files are changed.
