# Java Code Style Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the existing Java Code Style list from `AGENTS.md` into a project-local skill.

**Architecture:** Create `.claude/skills/java-code-style/SKILL.md` as the single home for the seven rules. Replace the section in `AGENTS.md` with a concise pointer to the skill.

**Tech Stack:** Markdown; repository-local Claude skill conventions.

---

### Task 1: Add the Java Code Style skill

**Files:**
- Create: `.claude/skills/java-code-style/SKILL.md`

- [ ] **Step 1: Add skill metadata and the extracted rules**

Create the skill with this content:

```markdown
---
name: java-code-style
description: Apply the PetClinic Java code-style rules when creating or changing Java code in this project.
---

# Java Code Style

- Keep lines under 120 characters.
- Keep methods under 30 lines.
- Use constructor injection in `src/main`; use `@Autowired` only in tests.
- Use `@Transactional` only when strictly necessary to wrap two or more database updates.
- Handle global REST exceptions with `@RestControllerAdvice`.
- Apply `@Validated` to every `@RequestBody`.
- Add `equals`, `hashCode`, or `toString` only when a class actually needs them.
```

### Task 2: Replace duplicated rules with a pointer

**Files:**
- Modify: `AGENTS.md` (`Java Code Style` section)

- [ ] **Step 1: Keep the section heading and add a link to the skill**

Replace the seven bullets under `## Java Code Style` with:

```markdown
See the [Java Code Style skill](.claude/skills/java-code-style/SKILL.md) when creating or
changing Java code in this project.
```

### Task 3: Verify the extraction

**Files:**
- Verify: `.claude/skills/java-code-style/SKILL.md`
- Verify: `AGENTS.md`

- [ ] **Step 1: Review the diff**

Run `git diff --check` and `git diff -- AGENTS.md .claude/skills/java-code-style/SKILL.md`.
Confirm all seven rules are present in the skill, the project instructions point to it, and
no unrelated files were changed. No automated test is needed for this documentation-only change.
