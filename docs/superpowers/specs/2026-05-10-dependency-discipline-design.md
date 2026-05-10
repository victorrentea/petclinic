# Guardrail D: Dependency Upgrade Discipline — Design

**Date:** 2026-05-10
**Status:** Approved for planning

## Goal

Replace ad-hoc / drive-by dependency upgrades with a predictable weekly batch via Dependabot. Make sure CVEs in our dependencies are surfaced.

## Scope

Two sub-guardrails. Both lightweight; no CI workflow changes.

### D1: Weekly batched dependency upgrades

Replace the existing broken `.github/dependabot.yml` (which targets `/` for Maven but the poms live elsewhere → no PRs opened). New config covers:

- **Maven backend** at `/petclinic-backend`
- **Maven database** at `/petclinic-database`
- **npm frontend** at `/petclinic-frontend`
- **GitHub Actions** at `/`

Each ecosystem produces **one weekly grouped PR** for minor+patch upgrades (Monday 09:00 UTC). Major upgrades stay as separate PRs so each one gets evaluated. Labels on every PR for filtering. Reviewer assignment to the user.

### D2: CVE awareness

Rely on **GitHub Dependabot security alerts** — built-in, zero config (assuming the repo's security settings are at defaults). Vulnerabilities surface in the Security tab and as auto-opened security PRs. Trivy / OWASP Dependency-Check / Snyk all considered and dropped — Dependabot alerts cover the same surface for a public repo with no operational cost.

## Files

- **Modify** `.github/dependabot.yml` — full rewrite per the structure above.
- **Modify** `GUARDRAILS.md` — move row D from 🚧 to ✅; describe Dependabot config + alert reliance.

## What it catches

- ✅ AI / contributor bumps a dep mid-PR without team awareness — the next weekly Dependabot PR re-introduces a clean diff against latest, exposing any out-of-band bump.
- ✅ Stale deps with known CVEs — Dependabot security alert auto-opens a PR.
- ❌ Yanked / broken upstream releases — Dependabot will offer them; CI must catch breakage.
- ❌ Supply-chain attacks via typosquatting — out of scope for D; would need npm/maven advisory feeds + signing checks.

## Cost

- One PR per ecosystem per week (worst case 4 PRs/week, often fewer when nothing changed).
- Major-version PRs trickle in separately; each takes engineer judgement.
- No CI runtime change.

## Non-goals

- Renovate (more configurable but requires GitHub App install — Dependabot is good enough for this project's scale).
- Trivy / OWASP scanner in CI.
- Auto-merge of patch-level updates — every dep change goes through PR review.
- Signing / provenance verification.
