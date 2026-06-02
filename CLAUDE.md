# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Living Architecture & Guardrails

See [GUARDRAILS.md](GUARDRAILS.md) for guardrail tests, living architecture diagrams, and CI drift checks.

## Task Modifiers
- Always write code using red-green TDD: write a failing test first, confirm it fails, then implement — no production code without a prior failing test
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise
- Challenge ambiguous/wrong prompts
