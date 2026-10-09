# Demo: a plugin marketplace from a plain folder

No git, no hosting: this folder is a marketplace (`.claude-plugin/marketplace.json`) listing one
plugin, `petclinic-tools`, which carries one skill, `grill-me`. The same folder installs in all three
harnesses. Run from the repo root:

| Harness | Install | Use |
| --- | --- | --- |
| Claude Code | `claude plugin marketplace add ./plugin-marketplace-demo`<br>`claude plugin install petclinic-tools@petclinic-local` | `/petclinic-tools:grill-me <plan>` |
| Copilot CLI | `copilot plugin marketplace add ./plugin-marketplace-demo`<br>`copilot plugin install petclinic-tools@petclinic-local` | `/petclinic-tools:grill-me <plan>` |
| Codex | `codex plugin marketplace add ./plugin-marketplace-demo`<br>`codex plugin add petclinic-tools@petclinic-local` | `$petclinic-tools:grill-me <plan>` |

Then start the agent in `petclinic-backend/` and in `notification-service/`: the skill is there in
both, although no `.claude/skills/` holds it any more.

Claude Code and Copilot read the plugin live from this folder; Codex copies it into its cache, so
after an edit run `codex plugin add` again.
